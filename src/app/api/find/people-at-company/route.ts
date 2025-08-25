import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { z } from "zod";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";

// Request validation schema
const FindPeopleRequestSchema = z.object({
  amount: z.number().int().min(1).max(50).default(15),
  companyId: z.uuid("Invalid company ID format"),
  alreadyFoundContacts: z
    .array(z.uuid("Invalid contact ID format"))
    .default([]),
});

// SearXNG response interfaces
interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
}

interface ParsedContactResult {
  title: string;
  url: string;
  content: string;
  firstName: string;
  lastName: string;
  fullName: string;
  linkedinUsername: string;
  generatedEmail: string;
  emailConfidence: number;
}

// Single AI Schema for combined contact parsing and email generation
const ContactAndEmailProcessingSchema = z.object({
  processedContacts: z.array(
    z.object({
      firstName: z.string(),
      lastName: z.string(),
      fullName: z.string(),
      linkedinUsername: z.string(),
      generatedEmail: z.string().describe("Pattern matched email address"),
      nameConfidence: z.number().min(0).max(1),
      emailConfidence: z.number().min(0).max(1),
    })
  ),
});

// Single AI call to parse contacts AND generate emails
async function processContactsAndEmailsWithAI(
  searchResults: SearXNGResult[],
  emailPattern: string,
  companyDomain: string
): Promise<ParsedContactResult[]> {
  try {
    if (searchResults.length === 0) {
      return [];
    }

    // Prepare minimal data for token efficiency
    const contactData = searchResults.map((result, index) => ({
      i: index, // Use short key
      t: result.title,
      u: result.url,
      c: result.content?.substring(0, 150) || "", // Shorter content
    }));

    const prompt = `Parse LinkedIn profiles and generate emails in one step.

EMAIL PATTERN: "${emailPattern}"
DOMAIN: ${companyDomain}

PROFILES:
${contactData.map((c) => `${c.i}|${c.t}|${c.u}`).join("\n")}

TASK:
1. Extract firstName, lastName from LinkedIn titles (format: "Name - Job")
2. Remove credentials (MBA, PhD), titles (Dr, Mr), company info  
3. Get username from URL (/in/username)
4. Generate email using pattern
5. Only return profiles with valid names, usernames, emails

PATTERN RULES:
- {first_name}.{last_name} → john.smith
- {first}{last} → johnsmith  
- {f}.{last_name} → j.smith
- first.last → john.smith

Set nameConfidence & emailConfidence (0-1) based on clarity.`;

    const result = await generateObject({
      model: groq("moonshotai/kimi-k2-instruct"),
      schema: ContactAndEmailProcessingSchema,
      prompt: prompt,
      temperature: 0.1,
    });

    // Combine AI results with original search data
    const processedContacts = result.object.processedContacts
      .map((aiContact, index) => {
        const originalResult =
          searchResults[index] ||
          searchResults.find((r) => r.url.includes(aiContact.linkedinUsername));

        if (!originalResult) return null;

        return {
          title: originalResult.title,
          url: originalResult.url,
          content: originalResult.content,
          firstName: aiContact.firstName,
          lastName: aiContact.lastName,
          fullName: aiContact.fullName,
          linkedinUsername: aiContact.linkedinUsername,
          generatedEmail: aiContact.generatedEmail,
          emailConfidence: aiContact.emailConfidence,
        };
      })
      .filter(
        (contact): contact is ParsedContactResult =>
          contact !== null &&
          contact.firstName &&
          contact.lastName &&
          contact.linkedinUsername &&
          contact.generatedEmail &&
          contact.emailConfidence > 0.3
      );

    console.log(
      `AI processed ${processedContacts.length} valid contacts with emails from ${searchResults.length} results`
    );
    return processedContacts;
  } catch (error) {
    console.error("Error processing contacts and emails with AI:", error);
    return [];
  }
}

// Search for contacts using SearXNG with single AI processing call
async function searchContacts(
  companyName: string,
  domain: string,
  alreadyFoundLinkedInUrls: string[],
  emailPattern?: string
): Promise<ParsedContactResult[]> {
  try {
    const baseUrl = process.env.SEARXNG_INSTANCE_URL || "http://localhost:8888";

    // Build exclusion string for already found contacts
    let exclusionString = "";
    if (alreadyFoundLinkedInUrls.length > 0) {
      const usernames = alreadyFoundLinkedInUrls
        .map((url) => {
          const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      if (usernames.length > 0) {
        exclusionString = usernames
          .map((username) => `-inurl:${username}`)
          .join(" ");
      }
    }

    const searchQuery =
      `site:linkedin.com/in "${companyName}" ${exclusionString}`.trim();
    const encodedQuery = encodeURIComponent(searchQuery);
    const searxngUrl = `${baseUrl}/search?q=${encodedQuery}&format=json`;

    console.log(
      `Searching contacts for ${companyName} with query: ${searchQuery}`
    );

    const response = await fetch(searxngUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(
        `SearXNG contact search failed for ${companyName}:`,
        response.status
      );
      return [];
    }

    const searchResults: SearXNGResponse = await response.json();
    const results = searchResults.results || [];

    // Filter for valid LinkedIn profiles
    const validLinkedInResults = results.filter((result) => {
      return (
        result.url?.includes("linkedin.com/in/") &&
        !result.url.includes("/pub/dir/") &&
        !result.url.includes("linkedin.com/in/popular") &&
        !result.url.includes("linkedin.com/in/directory")
      );
    });

    console.log(`Found ${validLinkedInResults.length} valid LinkedIn URLs`);

    if (validLinkedInResults.length === 0 || !emailPattern) {
      return [];
    }

    // Single AI call to process both names and emails
    const processedContacts = await processContactsAndEmailsWithAI(
      validLinkedInResults,
      emailPattern,
      domain
    );

    return processedContacts.slice(0, 15); // Return top 15 results
  } catch (error) {
    console.error(`Error searching contacts for ${companyName}:`, error);
    return [];
  }
}

// Helper function to generate emails for existing contacts using AI
async function generateEmailsForContacts(
  contacts: any[],
  companyId: string
): Promise<void> {
  const contactsWithoutEmails = contacts.filter(
    (contact) => !contact.contact_email || contact.contact_email.length === 0
  );

  if (contactsWithoutEmails.length === 0) {
    return;
  }

  console.log(
    `Generating emails for ${contactsWithoutEmails.length} existing contacts without emails`
  );

  // Get company's email pattern
  const { data: emailPatterns, error: emailPatternError } = await supabase
    .from("email_pattern")
    .select("pattern, confidence")
    .eq("company_id", companyId)
    .order("confidence", { ascending: false })
    .limit(1);

  if (emailPatternError) {
    console.error("Error fetching email pattern:", emailPatternError);
    return;
  }

  if (!emailPatterns || emailPatterns.length === 0) {
    console.warn(`No email pattern found for company ${companyId}`);
    return;
  }

  const emailPattern = emailPatterns[0];

  // Get company domain for fallback
  const { data: company } = await supabase
    .from("company")
    .select("website, normalized_domain")
    .eq("id", companyId)
    .single();

  const companyDomain = company?.normalized_domain || company?.website || "";

  // Prepare contacts for AI processing
  const contactsForAI = contactsWithoutEmails
    .filter((contact) => contact.first_name && contact.last_name)
    .map((contact) => ({
      firstName: contact.first_name,
      lastName: contact.last_name,
    }));

  if (contactsForAI.length === 0) {
    console.warn("No existing contacts with valid first and last names found");
    return;
  }

  // Use simplified email generation for existing contacts
  const EmailOnlySchema = z.object({
    emails: z.array(
      z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().describe("Pattern matched email address"),
        confidence: z.number().min(0).max(1),
      })
    ),
  });

  try {
    const contactList = contactsForAI
      .map((c) => `${c.firstName} ${c.lastName}`)
      .join("\n");

    const result = await generateObject({
      model: groq("moonshotai/kimi-k2-instruct"),
      schema: EmailOnlySchema,
      prompt: `Generate emails using pattern "${emailPattern.pattern}" for:\n${contactList}\n\nReturn valid emails only.`,
      temperature: 0.1,
    });

    // Prepare data for database insertion
    const emailsToInsert = result.object.emails
      .filter((result) => result.email && result.confidence > 0.3)
      .map((result) => {
        const contact = contactsWithoutEmails.find(
          (c) =>
            c.first_name.toLowerCase() === result.firstName.toLowerCase() &&
            c.last_name.toLowerCase() === result.lastName.toLowerCase()
        );
        return contact
          ? {
              contact_id: contact.id,
              email: result.email,
            }
          : null;
      })
      .filter(Boolean);

    // Bulk insert generated emails
    if (emailsToInsert.length > 0) {
      const { data: insertedEmails, error: emailInsertError } = await supabase
        .from("contact_email")
        .upsert(emailsToInsert, {
          onConflict: "contact_id,email",
        })
        .select("*");

      if (emailInsertError) {
        console.error("Error inserting generated emails:", emailInsertError);
      } else {
        console.log(
          `Successfully generated ${
            insertedEmails?.length || 0
          } emails for existing contacts`
        );

        // Update contacts with their new emails
        for (const contact of contactsWithoutEmails) {
          const contactEmails =
            insertedEmails?.filter((e) => e.contact_id === contact.id) || [];
          contact.contact_email = contactEmails;
        }
      }
    }
  } catch (error) {
    console.error("Error generating emails for existing contacts:", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = FindPeopleRequestSchema.parse(body);
    const { amount, companyId, alreadyFoundContacts } = validatedData;

    console.log(
      `Finding ${amount} people at company ${companyId}, excluding ${alreadyFoundContacts.length} already found contacts`
    );

    // Step 1: Get company information
    const { data: company, error: companyError } = await supabase
      .from("company")
      .select("id, name, website, normalized_domain")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return Response.json(
        {
          error: "Company not found",
          details:
            companyError?.message || "No company found with the provided ID",
        },
        { status: 404 }
      );
    }

    // Step 2: Get company's email pattern
    const { data: emailPatterns, error: emailPatternError } = await supabase
      .from("email_pattern")
      .select("pattern, confidence")
      .eq("company_id", companyId)
      .order("confidence", { ascending: false })
      .limit(1);

    const emailPattern = emailPatterns?.[0]?.pattern || "";

    // Step 3: Check existing contacts in database (excluding already found ones)
    let existingContactsQuery = supabase
      .from("contact")
      .select(
        `
        id, 
        first_name, 
        last_name, 
        bio, 
        linkedin_url,
        contact_email (
          id,
          email
        )
      `
      )
      .eq("company_id", companyId);

    // Exclude already found contacts if provided
    if (alreadyFoundContacts.length > 0) {
      existingContactsQuery = existingContactsQuery.not(
        "id",
        "in",
        `(${alreadyFoundContacts.join(",")})`
      );
    }

    const { data: existingContacts, error: existingContactsError } =
      await existingContactsQuery;

    if (existingContactsError) {
      throw new Error(
        `Failed to fetch existing contacts: ${existingContactsError.message}`
      );
    }

    console.log(
      `Found ${existingContacts?.length || 0} existing contacts in database`
    );

    // If we have enough existing contacts, generate emails for them and return
    const existingContactsCount = existingContacts?.length || 0;
    if (existingContactsCount >= amount) {
      const limitedExistingContacts = existingContacts!.slice(0, amount);

      // Generate emails for existing contacts that don't have them
      await generateEmailsForContacts(limitedExistingContacts, companyId);

      return Response.json({
        contacts: limitedExistingContacts,
        totalFound: limitedExistingContacts.length,
        existingCount: limitedExistingContacts.length,
        newCount: 0,
        companyName: company.name,
      });
    }

    // Step 4: We need to find more contacts - get LinkedIn URLs of existing contacts
    const existingLinkedInUrls =
      existingContacts
        ?.map((contact) => contact.linkedin_url)
        .filter((url) => url && url.length > 0) || [];

    // Step 5: Search for new contacts using SearXNG with AI processing
    const domain = company.normalized_domain || company.website || "";
    const newContactResults = await searchContacts(
      company.name,
      domain,
      existingLinkedInUrls,
      emailPattern
    );

    let newContacts: any[] = [];

    // Step 6: Process and store new contacts
    if (newContactResults.length > 0) {
      // Prepare contact data for bulk upsert
      const contactsData = newContactResults.map((contact) => ({
        company_id: companyId,
        first_name: contact.firstName,
        last_name: contact.lastName,
        bio: contact.content ? contact.content.substring(0, 500) : "",
        linkedin_url: contact.url,
      }));

      // Prepare email data for bulk upsert
      const emailsData = newContactResults
        .filter(
          (contact) => contact.generatedEmail && contact.emailConfidence > 0.3
        )
        .map((contact) => ({
          email: contact.generatedEmail,
          // We'll update this with contact_id after inserting contacts
          tempLinkedinUrl: contact.url,
        }));

      // Step 7: Bulk upsert new contacts
      const { data: insertedContacts, error: insertError } = await supabase
        .from("contact")
        .upsert(contactsData, {
          onConflict: "linkedin_url,company_id",
        }).select(`
          id, 
          first_name, 
          last_name, 
          bio, 
          linkedin_url,
          contact_email (
            id,
            email
          )
        `);

      if (insertError) {
        throw new Error(`Failed to upsert contacts: ${insertError.message}`);
      }

      newContacts = insertedContacts || [];

      // Step 8: Insert emails for new contacts
      if (newContacts.length > 0 && emailsData.length > 0) {
        const emailsToInsert = emailsData
          .map((emailData) => {
            const contact = newContacts.find(
              (c) => c.linkedin_url === emailData.tempLinkedinUrl
            );
            return contact
              ? {
                  contact_id: contact.id,
                  email: emailData.email,
                }
              : null;
          })
          .filter(Boolean);

        if (emailsToInsert.length > 0) {
          const { data: insertedEmails, error: emailInsertError } =
            await supabase
              .from("contact_email")
              .upsert(emailsToInsert, {
                onConflict: "contact_id,email",
              })
              .select("*");

          if (!emailInsertError && insertedEmails) {
            // Update contacts with their new emails
            for (const contact of newContacts) {
              const contactEmails = insertedEmails.filter(
                (e) => e.contact_id === contact.id
              );
              contact.contact_email = contactEmails;
            }
          }
        }
      }

      console.log(
        `Successfully processed ${newContacts.length} new contacts with emails`
      );
    }

    // Step 9: Combine existing and new contacts, deduplicate by ID, limit to requested amount
    const allContacts = [...(existingContacts || []), ...newContacts];

    // Deduplicate by contact ID to avoid duplicate entries
    const seenIds = new Set();
    const deduplicatedContacts = allContacts.filter((contact) => {
      if (seenIds.has(contact.id)) {
        return false;
      }
      seenIds.add(contact.id);
      return true;
    });

    const limitedContacts = deduplicatedContacts.slice(0, amount);

    console.log(`Returning ${limitedContacts.length} total contacts`);

    // Step 10: Generate emails for any remaining contacts that don't have them
    await generateEmailsForContacts(limitedContacts, companyId);

    // Step 11: Return the results
    return Response.json({
      contacts: limitedContacts,
      totalFound: limitedContacts.length,
      existingCount: existingContacts?.length || 0,
      newCount: newContacts.length,
      companyName: company.name,
    });
  } catch (error) {
    console.error("API Error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle other errors
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
