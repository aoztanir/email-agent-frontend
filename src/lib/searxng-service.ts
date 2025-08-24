interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface ParsedContactResult extends SearXNGResult {
  firstName: string;
  lastName: string;
  fullName: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
}

export interface EmailPatternResult {
  companyId: string;
  companyName: string;
  domain: string;
  rawPatternText: string;
  extractedPatterns: string[];
}

export { ParsedContactResult };

export class SearXNGService {
  private baseUrl: string;

  constructor(
    baseUrl: string = process.env.SEARXNG_INSTANCE_URL ||
      "http://localhost:8888"
  ) {
    this.baseUrl = baseUrl;
  }

  async searchEmailPatterns(
    companyName: string,
    domain: string
  ): Promise<string> {
    try {
      // Search for email patterns on RocketReach specifically
      const searchQuery = `rocketreach.co OR site:leadiq.com ${companyName} email format`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searxngUrl = `${this.baseUrl}/search?q=${encodedQuery}&format=json`;

      console.log(
        `Searching email patterns for ${companyName} at domain ${domain}`
      );

      const response = await fetch(searxngUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
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

      // Take the first result that looks like it contains email pattern information
      const relevantResult = results.find(
        (result) =>
          result.title?.toLowerCase().includes("email") ||
          result.content?.toLowerCase().includes("email") ||
          result.content?.toLowerCase().includes("@") ||
          result.title?.toLowerCase().includes(companyName.toLowerCase())
      );

      if (relevantResult) {
        console.log(relevantResult);
        // Return the content that likely contains email patterns
        // console.log(relevantResult);
        return `${relevantResult.title} ${relevantResult.content}`.substring(
          0,
          1000
        );
      }

      return "";
    } catch (error) {
      console.error(
        `Error searching email patterns for ${companyName}:`,
        error
      );
      return "";
    }
  }

  async searchContacts(
    companyName: string,
    domain: string
  ): Promise<ParsedContactResult[]> {
    try {
      // Use single simple LinkedIn query
      const searchQuery = `site:linkedin.com/in "${companyName}"`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searxngUrl = `${this.baseUrl}/search?q=${encodedQuery}&format=json`;

      console.log(
        `Searching contacts for ${companyName} with query: ${searchQuery}`
      );

      const response = await fetch(searxngUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
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
          const parsedName = this.parseLinkedInName(result.title);
          return {
            ...result,
            ...parsedName
          };
        })
        .filter((result) => result.firstName); // Only keep results with valid names

      console.log(
        `Found ${relevantResults.length} LinkedIn profiles with valid names for ${companyName}`
      );

      return relevantResults.slice(0, 15); // Return top 15 results
    } catch (error) {
      console.error(`Error searching contacts for ${companyName}:`, error);
      return [];
    }
  }

  private parseLinkedInName(title: string): { firstName: string; lastName: string; fullName: string } {
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
}
