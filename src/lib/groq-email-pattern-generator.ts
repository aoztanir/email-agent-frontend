import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const EmailPatternSchema = z.object({
  companyId: z.string(),
  name: z.string().describe("Company name"),
  pattern: z
    .string()
    .describe(
      "Single most likely email pattern like 'firstname.lastname@domain.com' or 'unsure' if uncertain"
    ),
  isUnsure: z
    .boolean()
    .describe(
      "True if AI is uncertain about the email pattern based on scraped data"
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
  isUnsure: boolean;
}

const model = groq("moonshotai/kimi-k2-instruct");

export async function generateEmailPatternsWithGroq(
  companies: CompanyForPatternGeneration[]
): Promise<GeneratedEmailPatterns[]> {
  try {
    const prompt = `Analyze the scraped email patterns and return the single most likely format template for each company.

${companies
  .map(
    (company) =>
      `ID: ${company.id} | Name: ${company.name} | Domain: ${
        company.domain
      } | Scraped Info: ${company.rawPatternText || "none"}`
  )
  .join("\n")}

Based on the scraped info provided above, identify the email pattern template for each company. If the scraped info contains clear email patterns, return patterns using EXACTLY these formats:
- firstname.lastname@domain.com (for patterns like john.smith@company.com)
- firstname@domain.com (for patterns like john@company.com)
- f.lastname@domain.com (for patterns like j.smith@company.com)
- firstnamelastname@domain.com (for patterns like johnsmith@company.com)
- lastname.firstname@domain.com (for patterns like smith.john@company.com)

Use EXACTLY these placeholder words: firstname, lastname, f, l, firstnamelastname, domain.com.

IMPORTANT: 
- If the scraped info is empty, unclear, or does not contain enough information to confidently determine an email pattern, see if you innately know the email pattern, especialy if it is a larger company; DO NOT give the client something incorrect though. If you are under 90% sure, set pattern to 'unsure' and isUnsure to true. 
- Only make confident predictions when you have clear evidence from the scraped data or clear evidence from your knowledge.
- Do NOT make up patterns - only use what you can clearly identify from the scraped information and your knowledge.`;

    console.log(prompt);
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
      pattern: "unsure",
      isUnsure: true,
    }));
  }
}
