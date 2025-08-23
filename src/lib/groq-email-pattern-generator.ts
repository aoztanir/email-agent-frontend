import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const EmailPatternSchema = z.object({
  companyId: z.string(),
  name: z.string().describe("Company name"),
  pattern: z
    .string()
    .describe(
      "Single most likely email pattern using standard formats like 'firstname.lastname@domain.com', 'firstname_lastname@domain.com', 'f.lastname@domain.com', 'firstnamelastname@domain.com', etc. or 'unsure' if uncertain"
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

**Standard Name Patterns:**
- firstname.lastname@[actual-domain] (use the company's actual domain)
- firstname_lastname@[actual-domain] (use the company's actual domain)
- firstname-lastname@[actual-domain] (use the company's actual domain) 
- firstnamelastname@[actual-domain] (use the company's actual domain)
- lastname.firstname@[actual-domain] (use the company's actual domain)
- lastname_firstname@[actual-domain] (use the company's actual domain)
- lastname-firstname@[actual-domain] (use the company's actual domain)
- lastnamefirstname@[actual-domain] (use the company's actual domain)

**First Name Only:**
- firstname@[actual-domain] (use the company's actual domain)

**Initial Patterns:**
- f.lastname@[actual-domain] (use the company's actual domain)
- f_lastname@[actual-domain] (use the company's actual domain)
- f-lastname@[actual-domain] (use the company's actual domain)
- flastname@[actual-domain] (use the company's actual domain)
- firstname.l@[actual-domain] (use the company's actual domain)
- firstname_l@[actual-domain] (use the company's actual domain)
- firstname-l@[actual-domain] (use the company's actual domain)
- firstnamel@[actual-domain] (use the company's actual domain)
- f.l@[actual-domain] (use the company's actual domain)
- f_l@[actual-domain] (use the company's actual domain)
- f-l@[actual-domain] (use the company's actual domain)
- fl@[actual-domain] (use the company's actual domain)

**Reverse Initial Patterns:**
- lastname.f@[actual-domain] (use the company's actual domain)
- lastname_f@[actual-domain] (use the company's actual domain)
- lastname-f@[actual-domain] (use the company's actual domain)
- lastnamef@[actual-domain] (use the company's actual domain)
- l.firstname@[actual-domain] (use the company's actual domain)
- l_firstname@[actual-domain] (use the company's actual domain)
- l-firstname@[actual-domain] (use the company's actual domain)
- lfirstname@[actual-domain] (use the company's actual domain)

**Number Patterns:**
- firstname.lastname1@[actual-domain] (use the company's actual domain)
- firstname.lastname2@[actual-domain] (use the company's actual domain)
- firstname1@[actual-domain] (use the company's actual domain)
- firstname2@[actual-domain] (use the company's actual domain)

**Department/Role Patterns:**
- firstname.lastname+dept@[actual-domain] (use the company's actual domain)
- dept.firstname@[actual-domain] (use the company's actual domain)
- dept_firstname@[actual-domain] (use the company's actual domain)

Use EXACTLY these placeholder words: firstname, lastname, f, l, firstnamelastname, lastnamefirstname, dept.
IMPORTANT: Always use the actual company domain in the email pattern, NOT 'domain.com' as a placeholder. For example:
- If the company domain is 'vanguard.com', return 'firstname_lastname@vanguard.com' 
- If the company domain is 'microsoft.com', return 'firstname.lastname@microsoft.com'
- Never return patterns with 'domain.com' - always use the real domain

Note: Separators can be dots (.), underscores (_), or hyphens (-). Numbers (1, 2) and department prefixes are also valid.

IMPORTANT GUIDELINES:
- If the scraped info is empty, unclear, or does not contain enough information to confidently determine an email pattern, see if you innately know the email pattern, especially if it is a larger company; DO NOT give the client something incorrect though. If you are under 90% sure, set pattern to 'unsure' and isUnsure to true.
- Only make confident predictions when you have clear evidence from the scraped data or clear evidence from your knowledge.
- Do NOT make up patterns - only use what you can clearly identify from the scraped information and your knowledge.
- Choose the MOST COMMON pattern for the company based on evidence - don't pick obscure variations unless clearly indicated.
- For large corporations, prefer standard patterns like 'firstname.lastname@domain.com' or 'firstname_lastname@domain.com'.
- If you see multiple patterns for a company, choose the most frequently used one.
- Consider company size and industry - startups often use 'firstname@domain.com', while enterprises typically use full name patterns.`;

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
