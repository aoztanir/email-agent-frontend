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
      const searchQuery = `rocketreach.co OR site:leadiq.com ${companyName} email format ${domain}`;
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
      // Search for contacts using multiple strategies
      const searchQueries = [
        `site:linkedin.com/in "${companyName}"`,
        `"${companyName}" contact email ${domain}`,
        `"${companyName}" team employees ${domain}`,
      ];

      const allResults: SearXNGResult[] = [];

      for (const query of searchQueries) {
        const encodedQuery = encodeURIComponent(query);
        const searxngUrl = `${this.baseUrl}/search?q=${encodedQuery}&format=json&engines=google,bing`;

        const response = await fetch(searxngUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 10000,
        });

        if (response.ok) {
          const searchResults: SearXNGResponse = await response.json();
          const results = searchResults.results || [];

          // Filter for relevant results
          const relevantResults = results.filter((result) => {
            if (query.includes("linkedin.com")) {
              return (
                result.url?.includes("linkedin.com/in/") &&
                !result.url.includes("/pub/dir/") &&
                !result.url.includes("linkedin.com/in/popular")
              );
            }
            return (
              result.title?.toLowerCase().includes(companyName.toLowerCase()) ||
              result.content?.toLowerCase().includes(companyName.toLowerCase())
            );
          });

          allResults.push(...relevantResults.slice(0, 5)); // Take top 5 from each query
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Remove duplicates by URL
      const uniqueResults = allResults.filter(
        (result, index, self) =>
          index === self.findIndex((r) => r.url === result.url)
      );

      return uniqueResults.slice(0, 15); // Return top 15 overall
    } catch (error) {
      console.error(`Error searching contacts for ${companyName}:`, error);
      return [];
    }
  }
}
