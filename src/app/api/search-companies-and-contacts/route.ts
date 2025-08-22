import { GoogleMapsFlareSolverrScraper } from "@/lib/google-maps-scraper-flaresolverr";
import { GroqCompanyFinder } from "@/lib/groq-company-finder";
import { supabase } from "@/lib/supabase";
import { YellowPagesFlareSolverrScraper } from "@/lib/yellow-pages-scraper";
import { NextRequest } from "next/server";

interface CompanySearchRequest {
  query: string;
  total?: number;
}

interface Company {
  name: string;
  address?: string;
  website?: string;
  phone_number?: string;
  place_id?: string;
  reviews_count?: number | null;
  reviews_average?: number | null;
  store_shopping?: string;
  in_store_pickup?: string;
  store_delivery?: string;
  place_type?: string;
  opens_at?: string;
  introduction?: string;
}

function normalizeWebsite(website?: string): string {
  if (!website) return "";

  try {
    // Add protocol if missing
    let url = website;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const parsed = new URL(url);
    let domain = parsed.hostname.toLowerCase();

    // Remove www. prefix
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }

    return domain;
  } catch {
    return website.toLowerCase().trim();
  }
}

function generateEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string
): Array<{ email: string; confidence: number }> {
  const patterns = [];
  const first = firstName.toLowerCase().trim();
  const last = lastName.toLowerCase().trim();

  // Clean names (remove special characters, keep only letters)
  const cleanFirst = first.replace(/[^a-z]/g, "");
  const cleanLast = last.replace(/[^a-z]/g, "");

  if (!cleanFirst || !domain) return [];

  // Most common patterns with confidence scores
  if (cleanLast) {
    patterns.push(
      { email: `${cleanFirst}.${cleanLast}@${domain}`, confidence: 85 },
      { email: `${cleanFirst}${cleanLast}@${domain}`, confidence: 75 },
      { email: `${cleanFirst}_${cleanLast}@${domain}`, confidence: 65 },
      { email: `${cleanFirst}@${domain}`, confidence: 60 },
      { email: `${cleanFirst[0]}${cleanLast}@${domain}`, confidence: 55 },
      { email: `${cleanFirst}${cleanLast[0]}@${domain}`, confidence: 50 }
    );
  } else {
    patterns.push({ email: `${cleanFirst}@${domain}`, confidence: 70 });
  }

  return patterns.slice(0, 4); // Return top 4 most likely patterns
}

export async function POST(req: NextRequest) {
  try {
    let body: CompanySearchRequest;

    try {
      body = await req.json();
    } catch (jsonError) {
      console.error("Failed to parse request body:", jsonError);
      console.error("Request method:", req.method);
      console.error(
        "Request headers:",
        Object.fromEntries(req.headers.entries())
      );
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { query, total = 20 } = body;

    if (!query) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    // Extract user's IP address for location fallback
    const userIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      undefined;

    console.log(
      `Received request: query="${query}", total=${total}, userIP=${userIP}`
    );

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        try {
          // Helper function to send SSE messages
          const sendSSE = (data: Record<string, unknown>) => {
            if (!isClosed) {
              const message = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));
            }
          };

          // Helper function to safely close the controller
          const safeClose = () => {
            if (!isClosed) {
              isClosed = true;
              controller.close();
            }
          };

          sendSSE({
            type: "status",
            message: "Discovering new companies...",
          });
          // const groq_finder = new GroqCompanyFinder();
          // const groqcompanies = await groq_finder.findCompanies(
          //   query,
          //   "United States",
          //   total
          // );
          // console.log(groqcompanies);

          // Scrape companies using Yellow Pages scraper with streaming
          const yScraper = new YellowPagesFlareSolverrScraper();
          let companiesStreamedCount = 0;
          const streamedDomains = new Set<string>();

          // const gScraper = new GoogleMapsFlareSolverrScraper();
          // const gcompanies = await gScraper.scrapeCompanies(query, total);
          // console.log(gcompanies);

          const companies = await yScraper.scrapeCompaniesIntelligent(
            query,
            total,
            async (company) => {
              // Stream each company as it's found

              try {
                if (company.website && company.website.trim()) {
                  const normalizedDomain = normalizeWebsite(company.website);

                  // Skip if we've already streamed this domain in this session
                  if (streamedDomains.has(normalizedDomain)) {
                    return;
                  }

                  streamedDomains.add(normalizedDomain);
                  companiesStreamedCount++;

                  // Prepare company for database - map Yellow Pages data to our schema
                  const scrapedCompany = {
                    name: company.name || "",
                    address: company.address || "",
                    website: company.website || "",
                    normalized_domain: normalizedDomain,
                    phone_number: company.phone_number || "",
                    reviews_count: company.reviews_count || null,
                    reviews_average: company.reviews_average || null,
                    store_shopping: company.store_shopping || "Unknown",
                    in_store_pickup: company.in_store_pickup || "Unknown",
                    store_delivery: company.store_delivery || "Unknown",
                    place_type: company.place_type || "",
                    opens_at: company.opens_at || "",
                    introduction: company.introduction || "",
                  };

                  // Insert company immediately
                  const { data: companyResult, error: companyError } =
                    await supabase
                      .from("scraped_company")
                      .upsert([scrapedCompany], {
                        onConflict: "normalized_domain",
                      })
                      .select()
                      .single();

                  if (!companyError && companyResult) {
                    // Stream the company to the client immediately
                    sendSSE({
                      type: "company_found",
                      company: companyResult,
                      progress: {
                        current: companiesStreamedCount,
                        total: total,
                      },
                    });
                  }
                }
              } catch (error) {
                console.error("Error streaming company:", error);
              }
            },
            userIP
          );

          // Store the prompt data after scraping is complete
          const promptData = {
            query_text: query,
            total_requested: total,
            total_found: companiesStreamedCount,
          };

          const { data: promptResult, error: promptError } = await supabase
            .from("prompt")
            .insert([promptData])
            .select()
            .single();

          if (promptError) {
            throw new Error(`Failed to store prompt: ${promptError.message}`);
          }

          const promptId = promptResult.id;

          // Get all companies that were streamed and create relationships
          if (companiesStreamedCount > 0) {
            // Get all companies that match our search criteria
            const { data: storedCompanies, error: fetchError } = await supabase
              .from("scraped_company")
              .select("id")
              .in(
                "normalized_domain",
                companies
                  .filter((c: Company) => c.website && c.website.trim())
                  .map((c: Company) => normalizeWebsite(c.website))
              );

            if (!fetchError && storedCompanies) {
              const relationships = storedCompanies.map(
                (company: { id: string }) => ({
                  prompt_id: promptId,
                  scraped_company_id: company.id,
                })
              );

              await supabase
                .from("prompt_to_scraped_company")
                .upsert(relationships, {
                  onConflict: "prompt_id,scraped_company_id",
                });
            }
          }
          sendSSE({
            type: "status",
            message: "Discovering contacts for companies...",
          });

          // Add timeout before proceeding
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Find contacts for companies using SearxNG + LinkedIn search
          const SEARXNG_BASE_URL =
            process.env.SEARXNG_INSTANCE_URL || "http://localhost:8888";
          let totalContactsFound = 0;

          // Get companies that were just scraped to find contacts for
          const { data: companiesToSearch, error: companiesError } =
            await supabase
              .from("scraped_company")
              .select("id, name, website, normalized_domain")
              .in(
                "normalized_domain",
                companies
                  .filter((c: Company) => c.website && c.website.trim())
                  .map((c: Company) => normalizeWebsite(c.website))
              );

          if (companiesError) {
            console.error(
              "Error fetching companies for contact search:",
              companiesError
            );
          } else if (companiesToSearch && companiesToSearch.length > 0) {
            sendSSE({
              type: "status",
              message: `Searching for contacts at ${companiesToSearch.length} companies...`,
            });

            // Process each company for contact finding
            for (const company of companiesToSearch) {
              try {
                // Search for LinkedIn profiles using SearxNG
                const searchQuery = `site:linkedin.com/in ${company.name}`;
                const encodedQuery = encodeURIComponent(searchQuery);
                const searxngUrl = `${SEARXNG_BASE_URL}/search?q=${encodedQuery}&format=json`;

                sendSSE({
                  type: "status",
                  message: `Finding profiles for ${company.name}...`,
                });

                const response = await fetch(searxngUrl, {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  },
                });

                if (!response.ok) {
                  console.error(
                    `SearxNG search failed for ${company.name}:`,
                    response.status
                  );
                  continue;
                }

                const searchResults = await response.json();

                const results = searchResults.results || [];

                console.log(
                  `SearxNG returned ${results.length} results for ${company.name}`
                );

                // Filter for actual LinkedIn profile URLs
                const linkedInProfiles = results
                  .filter(
                    (result: any) =>
                      result.url &&
                      result.url.includes("linkedin.com/in/") &&
                      result.title &&
                      !result.url.includes("/pub/dir/") && // Exclude directory pages
                      !result.url.includes("linkedin.com/in/popular") // Exclude generic pages
                  )
                  .slice(0, 15); // Limit to top 15 results per company

                // Extract contact information and save to database
                for (const profile of linkedInProfiles) {
                  try {
                    const profileUrl = profile.url;
                    const profileTitle = profile.title || "";

                    // Extract name from LinkedIn title (usually "FirstName LastName - Title at Company")
                    const nameMatch = profileTitle.match(
                      /^([^-|]+?)(?:\s*-|\s*\|)/
                    );
                    const fullName = nameMatch ? nameMatch[1].trim() : "";

                    if (!fullName) continue;

                    const nameParts = fullName.split(" ");
                    const firstName = nameParts[0] || "";
                    const lastName = nameParts.slice(1).join(" ") || "";

                    if (!firstName) continue;

                    // Check if contact already exists and get existing data
                    const { data: existingContact } = await supabase
                      .from("contact")
                      .select("*")
                      .eq("scraped_company_id", company.id)
                      .eq("linkedin_url", profileUrl)
                      .single();

                    let contactResult;
                    let isNewContact = false;

                    if (existingContact) {
                      // Use existing contact
                      contactResult = existingContact;
                    } else {
                      // Create new contact record
                      const contactData = {
                        scraped_company_id: company.id,
                        first_name: firstName,
                        last_name: lastName || null,
                        linkedin_url: profileUrl,
                        bio: profile.content
                          ? profile.content.substring(0, 500)
                          : null,
                      };

                      const { data: newContact, error: contactError } =
                        await supabase
                          .from("contact")
                          .insert([contactData])
                          .select()
                          .single();

                      if (!contactError && newContact) {
                        contactResult = newContact;
                        isNewContact = true;
                      } else {
                        console.error(
                          `Error saving contact for ${company.name}:`,
                          contactError
                        );
                        continue;
                      }
                    }

                    // Always stream the contact to the client (whether new or existing)
                    if (contactResult) {
                      totalContactsFound++;

                      sendSSE({
                        type: "contact_found",
                        contact: {
                          id: contactResult.id,
                          first_name: contactResult.first_name,
                          last_name: contactResult.last_name,
                          emails: [], // Will be populated later with email validation
                          scraped_company_id: company.id, // Use scraped_company.id for frontend consistency
                          company_name: company.name,
                          linkedin_url: contactResult.linkedin_url,
                          is_existing: !isNewContact,
                        },
                        progress: {
                          current: totalContactsFound,
                          company: company.name,
                        },
                      });
                    }
                  } catch (contactError) {
                    console.error(
                      `Error processing contact for ${company.name}:`,
                      contactError
                    );
                  }
                }
              } catch (error) {
                console.error(
                  `Error finding contacts for company ${company.name}:`,
                  error
                );
                continue;
              }
            }

            sendSSE({
              type: "status",
              message: `Found ${totalContactsFound} contacts across ${companiesToSearch.length} companies.`,
            });
          }

          // TODO EMAIL LOGIC - Get all companies and contacts for this session to generate emails
          sendSSE({
            type: "status",
            message: "Finding email addresses...",
          });

          // Get all companies found for this session with their contacts
          const { data: sessionCompanies, error: sessionError } = await supabase
            .from("prompt_to_scraped_company")
            .select("*, scraped_company (*)")
            .eq("prompt_id", promptId);

          if (sessionError) {
            console.log("hello");
            console.error("Error fetching session companies:", sessionError);
          } else if (sessionCompanies && sessionCompanies.length > 0) {
            console.log("hello");
            const companyIds = sessionCompanies.map(
              (item: any) => item.scraped_company.id
            );
            console.log(companyIds);

            // Get all contacts for these companies
            const { data: sessionContacts, error: contactsError } =
              await supabase
                .from("contact")
                .select(
                  `id, first_name, last_name, scraped_company_id, contact_email (*)`
                )
                .in("scraped_company_id", companyIds);

            if (contactsError) {
              console.error("Error fetching session contacts:", contactsError);
            } else if (sessionContacts) {
              sendSSE({
                type: "status",
                message: `Processing emails for ${sessionContacts.length} contacts...`,
              });

              // Process each contact for email generation/validation
              for (const contact of sessionContacts) {
                try {
                  const companyData = sessionCompanies.find(
                    (item: any) =>
                      item.scraped_company.id === contact.scraped_company_id
                  )?.scraped_company;

                  if (!companyData || !companyData.normalized_domain) continue;

                  const firstName = contact.first_name;
                  const lastName = contact.last_name || "";

                  if (!firstName) continue;

                  // // Check if contact already has emails
                  // const existingEmails = contact.contact_email || [];

                  // Generate email patterns for this contact
                  const emailPatterns = generateEmailPatterns(
                    firstName,
                    lastName,
                    companyData.normalized_domain
                  );

                  // Save generated emails to database
                  for (const emailPattern of emailPatterns) {
                    try {
                      // Validate emailPattern using hosted reacher api
                      const reacherResponse = await fetch(
                        "http://localhost:8080/v0/check_email",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            to_email: emailPattern.email,
                          }),
                        }
                      );

                      if (reacherResponse.ok) {
                        const validationResult = await reacherResponse.json();
                        console.log(validationResult);

                        // // Save email to database with validation results
                        // const emailData = {
                        //   contact_id: contact.id,
                        //   email: emailPattern.email,
                        //   confidence: emailPattern.confidence,
                        //   is_valid:
                        //     validationResult.is_reachable === "safe" ||
                        //     validationResult.is_reachable === "risky",
                        //   validation_status:
                        //     validationResult.is_reachable || "unknown",
                        //   validation_details: JSON.stringify(validationResult),
                        // };

                        // const { data: emailResult, error: emailError } =
                        //   await supabase
                        //     .from("contact_email")
                        //     .upsert([emailData], {
                        //       onConflict: "contact_id,email",
                        //     })
                        //     .select()
                        //     .single();

                        // if (!emailError && emailResult) {
                        //   sendSSE({
                        //     type: "email_validated",
                        //     contact_id: contact.id,
                        //     email: emailResult,
                        //     company_name: companyData.name,
                        //   });
                        // }
                      }
                    } catch (emailValidationError) {
                      console.error(
                        `Error validating email ${emailPattern.email}:`,
                        emailValidationError
                      );
                    }
                  }
                } catch (contactProcessError) {
                  console.error(
                    "Error processing contact for emails:",
                    contactProcessError
                  );
                }
              }
            }
          }

          //* ______________________________________COMPLETION______________________________________

          // Send completion event
          sendSSE({
            type: "complete",
            message: "Process completed successfully.",
            data: {
              promptId,
              companiesFound: companiesStreamedCount,
              companiesStored: companiesStreamedCount,
              contactsFound: totalContactsFound,
            },
          });

          safeClose();
        } catch (error) {
          console.error("Stream error:", error);
        } finally {
        }
      },
    });

    // Return the stream as a Server-Sent Events response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
