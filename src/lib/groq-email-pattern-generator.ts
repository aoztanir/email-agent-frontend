import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const EmailPatternSchema = z.object({
  companyId: z.string(),
  name: z.string().describe("Company name"),
  pattern: z
    .string()
    .describe(
      "Single most likely email pattern like 'firstname.lastname@domain.com'"
    ),
});

const BatchEmailPatternsSchema = z.object({
  companies: z.array(EmailPatternSchema),
});

export interface CompanyForPatternGeneration {
  id: string;
  name: string;
  domain: string;
  rawPatternText: string;
}

export interface GeneratedEmailPatterns {
  companyId: string;
  name: string;
  pattern: string;
}

const model = groq("meta-llama/llama-4-scout-17b-16e-instruct");

export async function generateEmailPatternsWithGroq(
  companies: CompanyForPatternGeneration[]
): Promise<GeneratedEmailPatterns[]> {
  try {
    const prompt = `Analyze email patterns and return the single most likely format for each company.

${companies
  .map(
    (company) =>
      `ID: ${company.id} | Name: ${company.name} | Domain: ${
        company.domain
      } | Info: ${company.rawPatternText || "none"}`
  )
  .join("\n")}

Return the most common corporate email pattern (firstname.lastname@domain.com, firstname@domain.com, etc.) for each company ID.`;

    const result = await generateObject({
      model,
      schema: BatchEmailPatternsSchema,
      prompt,
      temperature: 0.1,
    });
    console.log(result.object.companies);

    return result.object.companies;
  } catch (error) {
    console.error("Error generating email patterns with Groq:", error);

    // Fallback
    return companies.map((company) => ({
      companyId: company.id,
      name: company.name,
      pattern: "firstname.lastname@domain.com",
    }));
  }
}
