import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

interface CompanyResult {
  name: string;
  address: string;
  domain: string;
}

const CompanySchema = z.object({
  name: z.string(),
  address: z.string(),
  domain: z.string(),
});

const CompanyResponseSchema = z.object({
  companies: z.array(CompanySchema),
});

export class GroqCompanyFinder {
  private groq;

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }

    this.groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async findCompanies(
    query: string,
    location: string = "United States",
    limit: number = 20
  ): Promise<CompanyResult[]> {
    try {
      const result = await generateObject({
        model: this.groq("openai/gpt-oss-20b"),
        schema: CompanyResponseSchema,
        prompt: `Find ${limit} companies that match the query "${query}" in ${location}.
        
        Requirements:
        - Return real companies only, they should exist on the web
        - Include full street addresses when possible
        - Domain should be just the domain name (e.g., "example.com" not "https://example.com")
        - If no domain is known, use an empty string ""
        - Return exactly ${limit} companies or as many as you can find`,
      });

      // Validate and clean the results
      const validCompanies = result.object.companies
        .filter(
          (company) =>
            company.name &&
            typeof company.name === "string" &&
            company.address &&
            typeof company.address === "string"
        )
        .map((company) => ({
          name: company.name.trim(),
          address: company.address.trim(),
          domain: (company.domain || "").trim(),
        }));

      console.log(
        `Groq found ${validCompanies.length} companies for query: "${query}"`
      );
      return validCompanies;
    } catch (error) {
      console.error("Error finding companies with Groq:", error);
      throw error;
    }
  }
}
