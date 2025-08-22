import {
  CompanyForPatternGeneration,
  generateEmailPatternsWithGroq,
} from "@/lib/groq-email-pattern-generator";
import { SearXNGService } from "@/lib/searxng-service";
import { supabase } from "@/lib/supabase";
import { YellowPagesFlareSolverrScraper } from "@/lib/yellow-pages-scraper";
import { NextRequest } from "next/server";

interface CompanySearchRequest {
  query: string;
  total?: number;
}

interface StoredCompany {
  id: string;
  name: string;
  website: string;
  normalized_domain: string;
  address?: string;
  phone_number?: string;
}

interface CompanyEmailPattern {
  companyId: string;
  pattern: string;
  isUnsure: boolean;
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

export async function POST(req: NextRequest) {
  try {
    let body: CompanySearchRequest;

    try {
      body = await req.json();
    } catch (jsonError) {
      console.error("Failed to parse request body:", jsonError);
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

          // Initialize services
          const searxngService = new SearXNGService();

          // STEP 1: Discover Companies
          sendSSE({
            type: "status",
            message: "Discovering new companies...",
          });

          const yScraper = new YellowPagesFlareSolverrScraper();
          let companiesStreamedCount = 0;
          const streamedDomains = new Set<string>();
          const discoveredCompanies: StoredCompany[] = [];

          await yScraper.scrapeCompaniesIntelligent(
            query,
            total,
            async (company) => {
              try {
                if (company.website && company.website.trim()) {
                  const normalizedDomain = normalizeWebsite(company.website);

                  // Skip if we've already streamed this domain in this session
                  if (streamedDomains.has(normalizedDomain)) {
                    return;
                  }

                  streamedDomains.add(normalizedDomain);
                  companiesStreamedCount++;

                  // Prepare company for database
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
                    discoveredCompanies.push(companyResult);

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

          // Store the prompt data
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

          // Create prompt-company relationships
          if (discoveredCompanies.length > 0) {
            const relationships = discoveredCompanies.map((company) => ({
              prompt_id: promptId,
              scraped_company_id: company.id,
            }));

            await supabase
              .from("prompt_to_scraped_company")
              .upsert(relationships, {
                onConflict: "prompt_id,scraped_company_id",
              });
          }

          // STEP 2: Search for Email Patterns using SearXNG
          sendSSE({
            type: "status",
            message: "Searching for email patterns...",
          });

          const companiesForPatternGeneration: CompanyForPatternGeneration[] =
            [];

          for (const company of discoveredCompanies) {
            sendSSE({
              type: "status",
              message: `Finding email patterns for ${company.name}...`,
            });

            const patternText = await searxngService.searchEmailPatterns(
              company.name,
              company.normalized_domain
            );

            companiesForPatternGeneration.push({
              id: company.id,
              name: company.name,
              domain: company.normalized_domain,
              rawPatternText: patternText,
            });

            // Small delay between searches
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          // STEP 3: Generate Email Patterns using Groq AI
          sendSSE({
            type: "status",
            message: "Finding Emails...",
          });

          const emailPatterns = await generateEmailPatternsWithGroq(
            companiesForPatternGeneration
          );

          // Store email patterns in a map for quick lookup
          const emailPatternsMap = new Map<string, CompanyEmailPattern>();
          emailPatterns.forEach((pattern) => {
            emailPatternsMap.set(pattern.companyId, {
              companyId: pattern.companyId,
              pattern: pattern.pattern,
              isUnsure: pattern.isUnsure,
            });
          });

          sendSSE({
            type: "email_patterns_generated",
            data: {
              patternsCount: emailPatterns.length,
              patterns: emailPatterns,
            },
          });

          // STEP 4: Find Contacts using SearXNG (only for companies with certain email patterns)
          sendSSE({
            type: "status",
            message: "Discovering contacts...",
          });

          let totalContactsFound = 0;
          const contactsWithEmails: Array<{
            contact: {
              id: string;
              first_name: string;
              last_name: string | null;
              scraped_company_id: string;
              linkedin_url: string | null;
              bio: string | null;
            };
            generatedEmails: Array<{ email: string }>;
          }> = [];

          // Filter out companies where AI is unsure about email patterns
          const companiesWithCertainPatterns = discoveredCompanies.filter(company => {
            const pattern = emailPatternsMap.get(company.id);
            return pattern && !pattern.isUnsure;
          });

          const companiesWithUnsurePatterns = discoveredCompanies.filter(company => {
            const pattern = emailPatternsMap.get(company.id);
            return pattern && pattern.isUnsure;
          });

          // Send info about companies skipped due to uncertain patterns
          if (companiesWithUnsurePatterns.length > 0) {
            sendSSE({
              type: "uncertain_patterns",
              message: `Skipping contact discovery for ${companiesWithUnsurePatterns.length} companies due to uncertain email patterns`,
              companies: companiesWithUnsurePatterns.map(c => c.name),
            });
          }

          for (const company of companiesWithCertainPatterns) {
            sendSSE({
              type: "status",
              message: `Finding contacts for ${company.name}...`,
            });

            // Search for contacts using SearXNG
            const contactResults = await searxngService.searchContacts(
              company.name,
              company.normalized_domain
            );

            const companyEmailPattern = emailPatternsMap.get(company.id);

            // Process each contact result
            for (const contactResult of contactResults.slice(0, 10)) {
              // Limit to 10 per company
              try {
                // Extract contact info
                let fullName = "";
                let firstName = "";
                let lastName = "";

                if (contactResult.url.includes("linkedin.com/in/")) {
                  // Extract name from LinkedIn title
                  const nameMatch = contactResult.title.match(
                    /^([^-|]+?)(?:\s*-|\s*\|)/
                  );
                  fullName = nameMatch ? nameMatch[1].trim() : "";
                } else {
                  // Try to extract from title or content
                  const words = contactResult.title.split(/\s+/);
                  if (words.length >= 2) {
                    firstName = words[0];
                    lastName = words[1];
                    fullName = `${firstName} ${lastName}`;
                  }
                }

                if (!fullName) continue;

                const nameParts = fullName.split(" ");
                firstName = nameParts[0] || "";
                lastName = nameParts.slice(1).join(" ") || "";

                if (!firstName) continue;

                // Check if contact already exists
                const { data: existingContact } = await supabase
                  .from("contact")
                  .select("*")
                  .eq("scraped_company_id", company.id)
                  .eq("linkedin_url", contactResult.url)
                  .single();

                let contactData;
                let isNewContact = false;

                if (existingContact) {
                  contactData = existingContact;
                } else {
                  // Create new contact
                  const newContactData = {
                    scraped_company_id: company.id,
                    first_name: firstName,
                    last_name: lastName || null,
                    linkedin_url: contactResult.url.includes("linkedin.com")
                      ? contactResult.url
                      : null,
                    bio: contactResult.content
                      ? contactResult.content.substring(0, 500)
                      : null,
                  };

                  const { data: newContact, error: contactError } =
                    await supabase
                      .from("contact")
                      .insert([newContactData])
                      .select()
                      .single();

                  if (!contactError && newContact) {
                    contactData = newContact;
                    isNewContact = true;
                  } else {
                    console.error(
                      `Error saving contact for ${company.name}:`,
                      contactError
                    );
                    continue;
                  }
                }

                // STEP 5: Apply Email Patterns to Generate Emails
                const generatedEmails: Array<{ email: string }> = [];

                if (companyEmailPattern && contactData && !companyEmailPattern.isUnsure) {
                  console.log(`Generating email for ${firstName} ${lastName} using pattern: ${companyEmailPattern.pattern}`);
                  
                  // Generate email using the AI-analyzed pattern
                  let email = companyEmailPattern.pattern
                    // Handle combined patterns like "firstnamelastname"
                    .replace(/\bfirstnamelastname\b/g, `${firstName.toLowerCase()}${lastName.toLowerCase()}`)
                    .replace(/\blastnamefirstname\b/g, `${lastName.toLowerCase()}${firstName.toLowerCase()}`)
                    // Handle separated patterns
                    .replace(/\bfirstname\b/g, firstName.toLowerCase())
                    .replace(/\blastname\b/g, lastName.toLowerCase())
                    .replace(/\bfirst\b/g, firstName.toLowerCase())
                    .replace(/\blast\b/g, lastName.toLowerCase())
                    .replace(/\bf\b/g, firstName.charAt(0).toLowerCase())
                    .replace(/\bl\b/g, lastName.charAt(0).toLowerCase())
                    // Handle domain replacements
                    .replace(/domain\.com/g, company.normalized_domain)
                    .replace(/@domain/g, `@${company.normalized_domain}`);

                  // Clean up email - be more conservative about what we remove
                  email = email
                    .replace(/\s+/g, "")
                    .replace(/[^a-z0-9@._-]/g, "");
                  
                  console.log(`Generated email: ${email}`);

                  if (
                    email.includes("@") &&
                    email.includes(".") &&
                    !email.includes("undefined") &&
                    !email.includes("firstname") &&
                    !email.includes("lastname")
                  ) {
                    generatedEmails.push({ email });
                  } else {
                    console.warn(`Invalid email generated: ${email} for pattern: ${companyEmailPattern.pattern}`);
                  }
                }

                // Store the contact with g<enerated emails for later bulk insert
                contactsWithEmails.push({
                  contact: contactData,
                  generatedEmails: generatedEmails,
                });

                totalContactsFound++;

                console.log(
                  `Streaming contact: ${firstName} ${lastName} with ${generatedEmails.length} emails`
                );

                // Stream the contact with emails to the client
                sendSSE({
                  type: "contact_found",
                  contact: {
                    id: contactData.id,
                    first_name: contactData.first_name,
                    last_name: contactData.last_name,
                    emails: generatedEmails.map((e) => ({
                      email: e.email,
                      status: "Generated",
                    })),
                    company_id: company.id, // Use company_id instead of scraped_company_id
                    company_name: company.name,
                    linkedin_url: contactData.linkedin_url,
                    is_existing: !isNewContact,
                  },
                  progress: {
                    current: totalContactsFound,
                    company: company.name,
                  },
                });
              } catch (contactError) {
                console.error(
                  `Error processing contact for ${company.name}:`,
                  contactError
                );
              }
            }

            // Small delay between companies
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          // STEP 6: Bulk Insert Generated Emails
          sendSSE({
            type: "status",
            message: "Storing generated email addresses...",
          });

          const emailsToInsert: Array<{
            contact_id: string;
            email: string;
          }> = [];

          for (const { contact, generatedEmails } of contactsWithEmails) {
            for (const emailData of generatedEmails) {
              emailsToInsert.push({
                contact_id: contact.id,
                email: emailData.email,
              });
            }
          }

          if (emailsToInsert.length > 0) {
            console.log(
              `Inserting ${emailsToInsert.length} emails to database`
            );
            const { error: emailInsertError } = await supabase
              .from("contact_email")
              .upsert(emailsToInsert, {
                onConflict: "contact_id,email",
              });

            if (emailInsertError) {
              console.error(
                "Error inserting generated emails:",
                emailInsertError
              );
            } else {
              console.log(
                `Successfully inserted ${emailsToInsert.length} emails`
              );
            }
          }

          // Send completion event
          sendSSE({
            type: "complete",
            message: "Process completed successfully.",
            data: {
              promptId,
              companiesFound: companiesStreamedCount,
              contactsFound: totalContactsFound,
              emailsGenerated: emailsToInsert.length,
              emailPatternsGenerated: emailPatterns.length,
              companiesWithCertainPatterns: companiesWithCertainPatterns.length,
              companiesWithUnsurePatterns: companiesWithUnsurePatterns.length,
            },
          });

          safeClose();
        } catch (error) {
          console.error("Stream error:", error);
          // Send error event
          if (!isClosed) {
            const sendSSE = (data: Record<string, unknown>) => {
              const message = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));
            };

            sendSSE({
              type: "error",
              message: "An error occurred during processing",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
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
