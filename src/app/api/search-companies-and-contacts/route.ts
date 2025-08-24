import {
  CompanyForPatternGeneration,
  generateEmailPatternsWithGroq,
} from "@/lib/groq-email-pattern-generator";
import { GroqCompanyFinder } from "@/lib/groq-company-finder";
import { SearXNGService, ParsedContactResult } from "@/lib/searxng-service";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
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
  introduction?: string;
}

interface CompanyEmailPattern {
  companyId: string;
  pattern: string;
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

    const { query, total = 5 } = body;

    if (total > 10) {
      return Response.json(
        { error: "Total cannot exceed 10" },
        { status: 400 }
      );
    }

    if (!query) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    // Extract user's IP address for location fallback
    const userIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      undefined;

    // Check if user is authenticated (but allow anonymous searches)
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    
    console.log(
      `Received request: query="${query}", total=${total}, userIP=${userIP}, authenticated=${!!user}`
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
          const groqCompanyFinder = new GroqCompanyFinder();

          // STEP 1: Discover Companies using Groq
          sendSSE({
            type: "status",
            message: "Discovering companies with AI...",
          });

          let companiesStreamedCount = 0;
          const streamedDomains = new Set<string>();
          const discoveredCompanies: StoredCompany[] = [];

          try {
            const foundCompanies = await groqCompanyFinder.findCompanies(query, "United States", total);
            
            for (const company of foundCompanies) {
              try {
                const normalizedDomain = company.domain ? normalizeWebsite(company.domain) : "";

                // Skip if we've already streamed this domain in this session
                if (normalizedDomain && streamedDomains.has(normalizedDomain)) {
                  continue;
                }

                if (normalizedDomain) {
                  streamedDomains.add(normalizedDomain);
                }
                companiesStreamedCount++;

                // Prepare company for database
                const companyData = {
                  name: company.name || "",
                  address: company.address || "",
                  website: company.domain || "",
                  normalized_domain: normalizedDomain,
                  phone_number: "", // Groq doesn't provide phone numbers
                  introduction: company.description || "",
                };

                // Insert company immediately
                const { data: companyResult, error: companyError } =
                  await supabase
                    .from("company")
                    .upsert([companyData], {
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
              } catch (error) {
                console.error("Error processing company:", error);
              }
            }
          } catch (error) {
            console.error("Error finding companies with Groq:", error);
            // Send error but continue with empty results
            sendSSE({
              type: "error",
              message: "Failed to find companies with AI. Please try again.",
            });
          }

          // Store the prompt data with user_id if authenticated
          const promptData = {
            query_text: query,
            total_requested: total,
            total_found: companiesStreamedCount,
            user_id: user?.id || null, // Allow null for anonymous searches
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

          // Create user-company relationships for logged-in users
          // Anonymous searches won't have user_id in prompt, so skip this step
          if (discoveredCompanies.length > 0 && promptResult.user_id) {
            const relationships = discoveredCompanies.map((company) => ({
              user_id: promptResult.user_id,
              company_id: company.id,
              source_prompt_id: promptId,
            }));

            await supabase
              .from("user_company")
              .upsert(relationships, {
                onConflict: "user_id,company_id",
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
          console.log(`Generated email patterns:`, emailPatterns);
          const emailPatternsMap = new Map<string, CompanyEmailPattern>();
          emailPatterns.forEach((pattern) => {
            console.log(`Mapping pattern for ${pattern.companyId}: ${pattern.pattern}`);
            emailPatternsMap.set(pattern.companyId, {
              companyId: pattern.companyId,
              pattern: pattern.pattern,
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
              company_id: string;
              linkedin_url: string | null;
              bio: string | null;
            };
            generatedEmails: Array<{ email: string }>;
          }> = [];

          // Use all companies with patterns
          const companiesWithCertainPatterns = discoveredCompanies.filter(
            (company) => {
              const pattern = emailPatternsMap.get(company.id);
              return pattern;
            }
          );

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
            console.log(`Company: ${company.name} (${company.id})`);
            console.log(`Email pattern found:`, companyEmailPattern);

            // Process each contact result
            for (const contactResult of contactResults.slice(0, 10)) {
              // Limit to 10 per company
              try {
                // Contact parsing is now handled by SearXNG service
                const { firstName, lastName, fullName } = contactResult;

                if (!firstName || !fullName) continue;

                // Check if contact already exists
                const { data: existingContact } = await supabase
                  .from("contact")
                  .select("*")
                  .eq("company_id", company.id)
                  .eq("linkedin_url", contactResult.url)
                  .single();

                let contactData;
                let isNewContact = false;

                if (existingContact) {
                  contactData = existingContact;
                } else {
                  // Create new contact
                  const newContactData = {
                    company_id: company.id,
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

                if (
                  companyEmailPattern &&
                  contactData
                ) {
                  console.log(
                    `Generating email for ${firstName} ${lastName} using pattern: ${companyEmailPattern.pattern}`
                  );

                  // Generate email using the AI-analyzed pattern
                  console.log(`Original pattern: ${companyEmailPattern.pattern}`);
                  console.log(`Company domain: ${company.normalized_domain}`);
                  
                  let email = companyEmailPattern.pattern;
                  
                  // Handle combined patterns like "firstnamelastname" FIRST - most specific  
                  email = email.replace(/firstnamelastname/g, `${firstName.toLowerCase()}${lastName.toLowerCase()}`);
                  email = email.replace(/lastnamefirstname/g, `${lastName.toLowerCase()}${firstName.toLowerCase()}`);
                  
                  // Handle individual name patterns - don't use word boundaries with underscores
                  email = email.replace(/firstname/g, firstName.toLowerCase());
                  email = email.replace(/lastname/g, lastName.toLowerCase());
                  
                  // Handle shorter patterns - but be careful not to replace parts of longer words
                  // Only replace if it's a standalone word or part of an email pattern
                  email = email.replace(/\bfirst\b/g, firstName.toLowerCase());
                  email = email.replace(/\blast\b/g, lastName.toLowerCase());
                  
                  // Handle single letter patterns - only as standalone
                  email = email.replace(/\bf(?=[@._-])/g, firstName.charAt(0).toLowerCase());
                  email = email.replace(/\bl(?=[@._-])/g, lastName.charAt(0).toLowerCase());
                  
                  // Handle domain replacements - be more comprehensive
                  email = email.replace(/domain\.com/g, company.normalized_domain);
                  email = email.replace(/@domain/g, `@${company.normalized_domain}`);
                  email = email.replace(/\bdomain\b/g, company.normalized_domain);
                  
                  console.log(`Email after pattern replacement: ${email}`);

                  // Clean up email - be more conservative about what we remove
                  email = email
                    .replace(/\s+/g, "")
                    .replace(/[^a-z0-9@._\-+]/g, ""); // Allow underscores, dots, hyphens, and plus signs

                  console.log(`Generated email: ${email}`);

                  // More comprehensive email validation
                  const hasAt = email.includes("@");
                  const hasDot = email.includes(".");
                  const hasUndefined = email.includes("undefined");
                  const hasFirstname = email.includes("firstname");
                  const hasLastname = email.includes("lastname");
                  const hasFirstPlaceholder = email.includes("first");
                  const hasLastPlaceholder = email.includes("last");
                  const hasLetterPlaceholders = email.includes(" f ") || email.includes(" l ");
                  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                  
                  console.log(`Email validation for: ${email}`);
                  console.log(`- Has @: ${hasAt}`);
                  console.log(`- Has .: ${hasDot}`);
                  console.log(`- Has undefined: ${hasUndefined}`);
                  console.log(`- Has firstname: ${hasFirstname}`);
                  console.log(`- Has lastname: ${hasLastname}`);
                  console.log(`- Has first: ${hasFirstPlaceholder}`);
                  console.log(`- Has last: ${hasLastPlaceholder}`);
                  console.log(`- Matches regex: ${emailRegex.test(email)}`);
                  
                  if (
                    hasAt &&
                    hasDot &&
                    !hasUndefined &&
                    !hasFirstname &&
                    !hasLastname &&
                    !hasFirstPlaceholder &&
                    !hasLastPlaceholder &&
                    !hasLetterPlaceholders &&
                    emailRegex.test(email)
                  ) {
                    generatedEmails.push({ email });
                    console.log(`✅ Valid email generated: ${email}`);
                  } else {
                    console.warn(
                      `❌ Invalid email generated: ${email} for pattern: ${companyEmailPattern.pattern}`
                    );
                    console.warn(`Reasons: hasAt=${hasAt}, hasDot=${hasDot}, hasUndefined=${hasUndefined}, hasFirstname=${hasFirstname}, hasLastname=${hasLastname}, regex=${emailRegex.test(email)}`);
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

          // De-duplicate contacts by both contact identity and email address
          const uniqueContactsMap = new Map<string, {
            contact: any;
            generatedEmails: Array<{ email: string }>;
          }>();
          
          const seenEmails = new Set<string>();
          
          for (const { contact, generatedEmails } of contactsWithEmails) {
            // Create unique key based on contact name and company
            const contactKey = `${contact.first_name}_${contact.last_name}_${contact.company_id}`;
            
            // Filter out emails we've already seen
            const uniqueEmails = generatedEmails.filter(emailData => {
              if (seenEmails.has(emailData.email)) {
                return false; // Skip duplicate email
              }
              seenEmails.add(emailData.email);
              return true;
            });
            
            // Only add contact if they have unique emails and we haven't seen this contact before
            if (uniqueEmails.length > 0 && !uniqueContactsMap.has(contactKey)) {
              uniqueContactsMap.set(contactKey, {
                contact,
                generatedEmails: uniqueEmails
              });
            }
          }
          
          console.log(`De-duplicated contacts: ${contactsWithEmails.length} → ${uniqueContactsMap.size}`);
          
          const emailsToInsert: Array<{
            contact_id: string;
            email: string;
          }> = [];

          for (const { contact, generatedEmails } of uniqueContactsMap.values()) {
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
              companiesWithPatterns: companiesWithCertainPatterns.length,
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
