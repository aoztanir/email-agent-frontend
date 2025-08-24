import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { z } from "zod";

// Company schema for Groq response
const CompanySchema = z.object({
  name: z.string(),
  address: z.string(),
  domain: z.string(),
  description: z.string(),
});

const CompanyResponseSchema = z.object({
  companies: z.array(CompanySchema),
});

// Request validation schema
const FindCompaniesRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  amount: z.number().int().min(1).max(50).default(10),
});

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
    // Parse and validate request body
    const body = await req.json();
    const validatedData = FindCompaniesRequestSchema.parse(body);
    const { query, amount } = validatedData;

    console.log(`Finding ${amount} companies for query: "${query}"`);

    // Initialize Groq
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Step 1: Query Groq for companies
    console.log("Querying Groq for companies...");
    const result = await generateObject({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      schema: CompanyResponseSchema,
      prompt: `Find ${amount} companies that match the query "${query}" in United States.
      
      Requirements:
      - Return real companies only, they should exist on the web
      - Include full street addresses when possible
      - Domain should be just the domain name (e.g., "example.com" not "https://example.com")
      - If no domain is known, use an empty string ""
      - Include a one sentence description of what the company does
      - Return exactly ${amount} companies or as many as you can find
      `,
    });

    // Validate and clean the results
    const validCompanies = result.object.companies
      .filter(
        (company) =>
          company.name &&
          typeof company.name === "string" &&
          company.address &&
          typeof company.address === "string" &&
          company.description &&
          typeof company.description === "string"
      )
      .map((company) => ({
        name: company.name.trim(),
        address: company.address.trim(),
        domain: (company.domain || "").trim(),
        description: company.description.trim(),
      }));

    if (validCompanies.length === 0) {
      return Response.json({
        companies: [],
        message: "No companies found for the given query",
      });
    }

    console.log(`Groq found ${validCompanies.length} companies`);

    // Step 2: Prepare company data for bulk upsert
    const processedDomains = new Set<string>();
    const companiesData = [];

    for (const company of validCompanies) {
      const normalizedDomain = company.domain
        ? normalizeWebsite(company.domain)
        : "";

      // Skip if we've already processed this domain in this request
      if (normalizedDomain && processedDomains.has(normalizedDomain)) {
        continue;
      }

      if (normalizedDomain) {
        processedDomains.add(normalizedDomain);
      }

      // Prepare company data for database
      companiesData.push({
        name: company.name || "",
        address: company.address || "",
        website: company.domain || "",
        normalized_domain: normalizedDomain,
        phone_number: "", // Groq phone numbers not reliable
        introduction: company.description || "",
      });
    }

    // Step 3: Bulk upsert all companies
    const { data: companies, error: companiesError } = await supabase
      .from("company")
      .upsert(companiesData, {
        onConflict: "normalized_domain",
      })
      .select();

    if (companiesError) {
      throw new Error(`Failed to upsert companies: ${companiesError.message}`);
    }

    console.log(`Successfully processed ${companies?.length || 0} companies`);

    // Step 4: Return the database companies
    return Response.json({
      companies: companies || [],
      totalFound: companies?.length || 0,
      query,
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
