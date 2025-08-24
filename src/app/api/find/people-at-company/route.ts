import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { z } from "zod";

// Request validation schema
const FindPeopleRequestSchema = z.object({
  amount: z.number().int().min(1).max(50).default(15),
  companyId: z.string().uuid("Invalid company ID format"),
  alreadyFoundContacts: z.array(z.string().uuid("Invalid contact ID format")).default([]),
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

interface ParsedContactResult extends SearXNGResult {
  firstName: string;
  lastName: string;
  fullName: string;
  linkedinUsername: string;
}

// Search for contacts using SearXNG
async function searchContacts(
  companyName: string, 
  domain: string, 
  alreadyFoundLinkedInUrls: string[]
): Promise<ParsedContactResult[]> {
  try {
    const baseUrl = process.env.SEARXNG_INSTANCE_URL || "http://localhost:8888";
    
    // Build exclusion string for already found contacts
    let exclusionString = "";
    if (alreadyFoundLinkedInUrls.length > 0) {
      const usernames = alreadyFoundLinkedInUrls
        .map(url => {
          const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      
      if (usernames.length > 0) {
        exclusionString = usernames.map(username => `-inurl:${username}`).join(" ");
      }
    }

    const searchQuery = `site:linkedin.com/in "${companyName}" ${exclusionString}`.trim();
    const encodedQuery = encodeURIComponent(searchQuery);
    const searxngUrl = `${baseUrl}/search?q=${encodedQuery}&format=json`;

    console.log(`Searching contacts for ${companyName} with query: ${searchQuery}`);

    const response = await fetch(searxngUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`SearXNG contact search failed for ${companyName}:`, response.status);
      return [];
    }

    const searchResults: SearXNGResponse = await response.json();
    const results = searchResults.results || [];

    // Filter for valid LinkedIn profiles and parse names
    const relevantResults = results
      .filter((result) => {
        return (
          result.url?.includes("linkedin.com/in/") &&
          !result.url.includes("/pub/dir/") &&
          !result.url.includes("linkedin.com/in/popular") &&
          !result.url.includes("linkedin.com/in/directory")
        );
      })
      .map((result) => {
        const parsedName = parseLinkedInName(result.title);
        const linkedinUsername = extractLinkedInUsername(result.url);
        return {
          ...result,
          ...parsedName,
          linkedinUsername,
        };
      })
      .filter((result) => result.firstName && result.linkedinUsername); // Only keep results with valid names and usernames

    console.log(`Found ${relevantResults.length} LinkedIn profiles with valid names for ${companyName}`);

    return relevantResults.slice(0, 15); // Return top 15 results
  } catch (error) {
    console.error(`Error searching contacts for ${companyName}:`, error);
    return [];
  }
}

// Parse LinkedIn name from title
function parseLinkedInName(title: string): { firstName: string; lastName: string; fullName: string } {
  try {
    // LinkedIn titles typically follow: "Name - Title/Company" pattern
    const nameMatch = title.match(/^(.+?)\s*-\s*/);
    if (!nameMatch) {
      return { firstName: "", lastName: "", fullName: "" };
    }

    let fullName = nameMatch[1].trim();
    
    // Remove common patterns that aren't part of the name
    fullName = fullName
      // Remove parenthetical info like "(Sun)" or "(MBA)"
      .replace(/\s*\([^)]*\)/g, '')
      // Remove titles like "Dr.", "Mr.", "Ms.", etc.
      .replace(/^(Dr|Mr|Ms|Mrs|Prof|Professor)\.?\s+/i, '')
      // Remove suffixes like "Jr.", "Sr.", "III", etc.
      .replace(/\s+(Jr|Sr|II|III|IV|V)\.?$/i, '')
      .trim();

    // Simple approach: remove anything after comma, period, or common separators
    // This handles cases like "Kelley Beckett, MBA" or "Gui Batista, MBA" 
    fullName = fullName
      // Remove everything after comma (most common case)
      .replace(/\s*,.*$/, '')
      // Remove everything after period if followed by space and capital letters (credentials)
      .replace(/\s*\.\s+[A-Z]{2,}.*$/, '')
      // Remove standalone credentials at the end
      .split(/\s+/)
      .filter(word => {
        // Keep word if it's not a known credential pattern
        const cleanWord = word.replace(/[,.]$/, '');
        // Simple heuristic: if it's all caps and 2-5 letters, likely a credential
        return !(cleanWord.match(/^[A-Z]{2,5}$/) && cleanWord.length >= 2);
      })
      .join(' ')
      .trim();

    if (!fullName) {
      return { firstName: "", lastName: "", fullName: "" };
    }

    // Split name into parts
    const nameParts = fullName.split(/\s+/).filter(part => part.length > 0);
    
    if (nameParts.length === 0) {
      return { firstName: "", lastName: "", fullName: "" };
    }
    
    let firstName = nameParts[0];
    let lastName = "";
    
    if (nameParts.length === 1) {
      // Single name - use as first name
      lastName = "";
    } else if (nameParts.length === 2) {
      // First Last
      lastName = nameParts[1];
    } else {
      // Multiple names - take first as firstName, last as lastName
      // Skip middle names/initials
      firstName = nameParts[0];
      lastName = nameParts[nameParts.length - 1];
      
      // Handle cases where middle part might be a preferred name or initial
      if (nameParts.length >= 3) {
        const middleParts = nameParts.slice(1, -1);
        
        // Check if any middle parts are initials or credential-like patterns
        const hasMiddleInitials = middleParts.some(part => {
          const cleanPart = part.replace(/[,.]$/, ''); // Remove trailing comma/period
          return (
            cleanPart.length === 1 || // Single letter
            part.endsWith('.') || // Letter with period
            // Pattern-based detection: all caps 2-5 letters likely a credential/initial
            (cleanPart.match(/^[A-Z]{2,5}$/) && cleanPart.length >= 2)
          );
        });
        
        if (hasMiddleInitials) {
          // Skip middle initials/abbreviations
          // e.g., "David M Solomon" -> David Solomon
          // e.g., "Jamie Laird PCS" -> Jamie Laird
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 3) {
          // Three names without initials - might be compound last name
          // e.g., "Emily Glassberg Sands" -> firstName: Emily, lastName: Glassberg Sands
          lastName = nameParts.slice(1).join(' ');
        } else {
          // More than 3 parts without clear initials - take first and last
          lastName = nameParts[nameParts.length - 1];
        }
      }
    }
    
    // Clean up names - remove any remaining non-alphabetic characters except hyphens
    firstName = firstName.replace(/[^a-zA-Z-']/g, '').trim();
    lastName = lastName.replace(/[^a-zA-Z-'\s]/g, '').trim();
    
    // Validate names
    if (!firstName || firstName.length < 2) {
      return { firstName: "", lastName: "", fullName: "" };
    }
    
    const finalFullName = lastName ? `${firstName} ${lastName}` : firstName;
    
    console.log(`Parsed LinkedIn name: "${title}" -> Cleaned: "${fullName}" -> First: "${firstName}", Last: "${lastName}", Full: "${finalFullName}"`);
    
    return {
      firstName,
      lastName,
      fullName: finalFullName
    };
  } catch (error) {
    console.error(`Error parsing LinkedIn name from title: "${title}"`, error);
    return { firstName: "", lastName: "", fullName: "" };
  }
}

// Extract LinkedIn username from URL
function extractLinkedInUsername(url: string): string {
  try {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : "";
  } catch (error) {
    console.error(`Error extracting LinkedIn username from URL: "${url}"`, error);
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = FindPeopleRequestSchema.parse(body);
    const { amount, companyId, alreadyFoundContacts } = validatedData;

    console.log(`Finding ${amount} people at company ${companyId}, excluding ${alreadyFoundContacts.length} already found contacts`);

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
          details: companyError?.message || "No company found with the provided ID",
        },
        { status: 404 }
      );
    }

    // Step 2: Check existing contacts in database (excluding already found ones)
    let existingContactsQuery = supabase
      .from("contact")
      .select(`
        id, 
        first_name, 
        last_name, 
        bio, 
        linkedin_url,
        contact_email (
          id,
          email
        )
      `)
      .eq("company_id", companyId);

    // Exclude already found contacts if provided
    if (alreadyFoundContacts.length > 0) {
      existingContactsQuery = existingContactsQuery.not("id", "in", `(${alreadyFoundContacts.join(",")})`);
    }

    const { data: existingContacts, error: existingContactsError } = await existingContactsQuery;

    if (existingContactsError) {
      throw new Error(`Failed to fetch existing contacts: ${existingContactsError.message}`);
    }

    console.log(`Found ${existingContacts?.length || 0} existing contacts in database`);

    // If we have enough existing contacts, return them
    const existingContactsCount = existingContacts?.length || 0;
    if (existingContactsCount >= amount) {
      const limitedExistingContacts = existingContacts!.slice(0, amount);
      return Response.json({
        contacts: limitedExistingContacts,
        totalFound: limitedExistingContacts.length,
        existingCount: limitedExistingContacts.length,
        newCount: 0,
        companyName: company.name,
      });
    }

    // Step 3: We need to find more contacts - get LinkedIn URLs of existing contacts
    const existingLinkedInUrls = existingContacts
      ?.map(contact => contact.linkedin_url)
      .filter(url => url && url.length > 0) || [];

    // Step 4: Search for new contacts using SearXNG
    const domain = company.normalized_domain || company.website || "";
    const newContactResults = await searchContacts(company.name, domain, existingLinkedInUrls);

    let newContacts: any[] = [];

    // Step 5: Process and store new contacts
    if (newContactResults.length > 0) {
      // Prepare contact data for bulk upsert
      const contactsData = newContactResults.map((contact) => ({
        company_id: companyId,
        first_name: contact.firstName,
        last_name: contact.lastName,
        bio: contact.content ? contact.content.substring(0, 500) : "", // Limit bio length
        linkedin_url: contact.url,
      }));

      // Step 6: Bulk upsert new contacts
      const { data: insertedContacts, error: insertError } = await supabase
        .from("contact")
        .upsert(contactsData, {
          onConflict: "linkedin_url,company_id", // Use our unique constraint
        })
        .select(`
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
      console.log(`Successfully inserted ${newContacts.length} new contacts`);
    }

    // Step 7: Combine existing and new contacts, limit to requested amount
    const allContacts = [...(existingContacts || []), ...newContacts];
    const limitedContacts = allContacts.slice(0, amount);

    console.log(`Returning ${limitedContacts.length} total contacts`);

    // Step 8: Return the results
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