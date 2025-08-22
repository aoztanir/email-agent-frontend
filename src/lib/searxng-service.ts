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

export interface EmailPatternResult {
  companyId: string;
  companyName: string;
  domain: string;
  rawPatternText: string;
  extractedPatterns: string[];
}

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
  ): Promise<SearXNGResult[]> {
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

      // Filter for valid LinkedIn profiles
      const relevantResults = results.filter((result) => {
        return (
          result.url?.includes("linkedin.com/in/") &&
          !result.url.includes("/pub/dir/") &&
          !result.url.includes("linkedin.com/in/popular") &&
          !result.url.includes("linkedin.com/in/directory")
        );
      });

      console.log(
        `Found ${relevantResults.length} LinkedIn profiles for ${companyName}`
      );

      return relevantResults.slice(0, 15); // Return top 15 results
    } catch (error) {
      console.error(`Error searching contacts for ${companyName}:`, error);
      return [];
    }
  }
}
