import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { z } from "zod";

// Email pattern schema for Groq response
const EmailPatternSchema = z.object({
  companyId: z.string(),
  name: z.string().describe("Company name"),
  pattern: z
    .string()
    .describe(
      "Single most likely email pattern using standard formats like 'firstname.lastname@domain.com', 'firstname_lastname@domain.com', 'f.lastname@domain.com', 'firstnamelastname@domain.com', etc."
    ),
});

const BatchEmailPatternsSchema = z.object({
  companies: z.array(EmailPatternSchema),
});

// Request validation schema
const FindEmailPatternsRequestSchema = z.object({
  companyIds: z
    .array(z.uuid("Invalid company ID format"))
    .min(1, "At least one company ID is required"),
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

// Search for email patterns using SearXNG
async function searchEmailPatterns(
  companyName: string,
  domain: string
): Promise<string> {
  try {
    const baseUrl = process.env.SEARXNG_INSTANCE_URL || "http://localhost:8888";
    const searchQuery = `site:rocketreach.co OR site:leadiq.com ${companyName} email format`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const searxngUrl = `${baseUrl}/search?q=${encodedQuery}&format=json`;

    console.log(
      `Searching email patterns for ${companyName} at domain ${domain}`
    );

    const response = await fetch(searxngUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      // Note: fetch timeout is not supported in Node.js fetch API, using signal instead
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(
        `SearXNG search failed for ${companyName}:`,
        response.status
      );
      return "";
    }

    const searchResults: SearXNGResponse = await response.json();
    const results = searchResults.results || [];

    // Find the first result that looks like it contains email pattern information
    const relevantResult = results.find(
      (result) =>
        result.title?.toLowerCase().includes("email") ||
        result.content?.toLowerCase().includes("email") ||
        result.content?.toLowerCase().includes("@") ||
        result.title?.toLowerCase().includes(companyName.toLowerCase())
    );

    if (relevantResult) {
      console.log(
        `Found relevant email pattern result for ${companyName}:`,
        relevantResult.title
      );
      // Return the content that likely contains email patterns
      return `${relevantResult.title} ${relevantResult.content}`.substring(
        0,
        1000
      );
    }

    return "";
  } catch (error) {
    console.error(`Error searching email patterns for ${companyName}:`, error);
    return "";
  }
}

// Parse email patterns using Groq AI
async function parseEmailPatternsWithGroq(
  companies: Array<{
    id: string;
    name: string;
    domain: string;
    rawPatternText: string;
  }>
): Promise<Array<{ companyId: string; name: string; pattern: string }>> {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const prompt = `Analyze email patterns and return the most likely format for each company.

${companies
  .map(
    (company) =>
      `ID: ${company.id} | Name: ${company.name} | Domain: ${
        company.domain
      } | Info: ${company.rawPatternText || "none"}`
  )
  .join("\n")}

Return patterns using the company's actual domain (not 'domain.com'). Common formats:

Standard: firstname.lastname@domain, firstname_lastname@domain, firstname@domain, firstnamelastname@domain
Initials: f.lastname@domain, f_lastname@domain, f.l@domain, fl@domain  
Reverse: lastname.firstname@domain, lastname_firstname@domain
Numbers: firstname1@domain, firstname.lastname1@domain

Use placeholders: firstname, lastname, f, l, firstnamelastname, lastnamefirstname

Rules:
- Use actual company domain (e.g. firstname_lastname@vanguard.com)
- Large companies: prefer firstname.lastname or firstname_lastname formats
- Only use patterns you can identify from the above data or your knowledge`;

    console.log("Generating email patterns with Groq...");
    const result = await generateObject({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      schema: BatchEmailPatternsSchema,
      prompt,
      temperature: 0.1,
    });

    console.log(
      `Groq generated ${result.object.companies.length} email patterns`
    );
    return result.object.companies;
  } catch (error) {
    console.error("Error generating email patterns with Groq:", error);

    // Fallback: return default patterns
    return companies.map((company) => ({
      companyId: company.id,
      name: company.name,
      pattern: "firstname.lastname@" + company.domain,
    }));
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = FindEmailPatternsRequestSchema.parse(body);
    const { companyIds } = validatedData;

    console.log(`Finding email patterns for ${companyIds.length} companies`);

    // Step 1: Check which companies already have email patterns in the database
    const { data: existingPatterns, error: existingPatternsError } =
      await supabase
        .from("email_pattern")
        .select("*, company:company_id(id, name, website, normalized_domain)")
        .in("company_id", companyIds);

    if (existingPatternsError) {
      throw new Error(
        `Failed to fetch existing email patterns: ${existingPatternsError.message}`
      );
    }

    const existingCompanyIds = new Set(
      existingPatterns?.map((p) => p.company_id) || []
    );
    const missingCompanyIds = companyIds.filter(
      (id) => !existingCompanyIds.has(id)
    );

    console.log(
      `Found ${existingPatterns?.length || 0} existing patterns, need to find ${
        missingCompanyIds.length
      } new ones`
    );

    let newPatterns: any[] = [];

    // Step 2: For missing patterns, fetch company data and search for patterns
    if (missingCompanyIds.length > 0) {
      // Get company data for missing patterns
      const { data: companies, error: companiesError } = await supabase
        .from("company")
        .select("id, name, website, normalized_domain")
        .in("id", missingCompanyIds);

      if (companiesError) {
        throw new Error(
          `Failed to fetch company data: ${companiesError.message}`
        );
      }

      if (!companies || companies.length === 0) {
        console.log("No companies found for the provided IDs");
      } else {
        // Step 3: Search for email patterns using SearXNG for each company
        const companiesWithPatternData = [];

        for (const company of companies) {
          const domain = company.normalized_domain || company.website || "";

          if (!domain) {
            console.log(`Skipping ${company.name} - no domain available`);
            continue;
          }

          const rawPatternText = await searchEmailPatterns(
            company.name,
            domain
          );

          companiesWithPatternData.push({
            id: company.id,
            name: company.name,
            domain: domain,
            rawPatternText: rawPatternText,
          });
        }

        // Step 4: Parse patterns with Groq AI
        if (companiesWithPatternData.length > 0) {
          const parsedPatterns = await parseEmailPatternsWithGroq(
            companiesWithPatternData
          );

          // Step 5: Prepare data for database insertion
          const emailPatternsData = parsedPatterns.map((pattern) => ({
            company_id: pattern.companyId,
            pattern: pattern.pattern,
            confidence: 0.8, // Default confidence
            raw_pattern_text:
              companiesWithPatternData.find((c) => c.id === pattern.companyId)
                ?.rawPatternText || "",
            source: "searxng_groq",
          }));

          // Step 6: Bulk upsert email patterns
          if (emailPatternsData.length > 0) {
            const { data: insertedPatterns, error: insertError } =
              await supabase
                .from("email_pattern")
                .upsert(emailPatternsData, {
                  onConflict: "company_id",
                })
                .select(
                  "*, company:company_id(id, name, website, normalized_domain)"
                );

            if (insertError) {
              throw new Error(
                `Failed to upsert email patterns: ${insertError.message}`
              );
            }

            newPatterns = insertedPatterns || [];
            console.log(
              `Successfully inserted ${newPatterns.length} new email patterns`
            );
          }
        }
      }
    }

    // Step 7: Combine existing and new patterns
    const allPatterns = [...(existingPatterns || []), ...newPatterns];

    console.log(`Returning ${allPatterns.length} total email patterns`);

    // Step 8: Return the results
    return Response.json({
      emailPatterns: allPatterns,
      totalFound: allPatterns.length,
      existingCount: existingPatterns?.length || 0,
      newCount: newPatterns.length,
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
