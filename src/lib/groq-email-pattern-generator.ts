import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

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

const model = groq("moonshotai/kimi-k2-instruct");

export async function generateEmailPatternsWithGroq(
  companies: CompanyForPatternGeneration[]
): Promise<GeneratedEmailPatterns[]> {
  try {
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
      pattern: "firstname.lastname@" + company.domain,
    }));
  }
}
