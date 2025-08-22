import axios from "axios";
import * as cheerio from "cheerio";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

interface YellowPagesListing {
  name: string;
  address: string;
  website: string;
  phone_number: string;
  reviews_count: number | null;
  reviews_average: number | null;
  store_shopping: string;
  in_store_pickup: string;
  store_delivery: string;
  place_type: string;
  opens_at: string;
  introduction: string;
  place_id: string;
}

// Zod schema for location analysis
const LocationAnalysisSchema = z.object({
  hasSpecificLocation: z.boolean(),
  extractedLocation: z.string().optional(),
  strippedQuery: z.string(),
  optimizedQuery: z.string(),
  reasoning: z.string(),
});

type LocationAnalysis = z.infer<typeof LocationAnalysisSchema>;

interface FlareSolverrResponse {
  solution: {
    url: string;
    status: number;
    headers: Record<string, string>;
    response: string;
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
    }>;
    userAgent: string;
  };
  status: string;
  message: string;
  startTimestamp: number;
  endTimestamp: number;
}

class YellowPagesFlareSolverrScraper {
  private flaresolverrUrl: string;
  private baseDelay: number;
  private sessionId?: string;

  constructor(flaresolverrUrl: string = "http://localhost:8191") {
    this.flaresolverrUrl = flaresolverrUrl;
    this.baseDelay = 2000;
    this.setupLogging();
  }

  private setupLogging(): void {
    console.log("Yellow Pages FlareSolverr Scraper initialized");
  }

  private log(level: "INFO" | "WARNING" | "ERROR", message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${level} - ${message}`);
  }

  private async analyzeLocationRequest(
    query: string
  ): Promise<LocationAnalysis> {
    try {
      this.log("INFO", `Analyzing location intent for query: "${query}"`);

      const result = await generateObject({
        model: groq("openai/gpt-oss-20b"),
        schema: LocationAnalysisSchema,
        prompt: `Analyze this business search query for location extraction and optimization for Yellow Pages search:

Query: "${query}"

Tasks:
1. Location Detection: Determine if query mentions specific cities, states, zip codes, or regions
2. Location Extraction: If location found, extract and standardize it (e.g., "Chicago" → "Chicago, IL")
3. Query Stripping: Remove location parts from original query
4. Query Optimization: Create a concise, Yellow Pages-friendly search term

Rules:
- Be precise in location detection - only extract if clearly mentioned
- Strip location words (in, near, around, at) and the location itself
- Optimize query to be 1-3 keywords maximum for better Yellow Pages results
- Use business category terms that Yellow Pages understands

Examples:
"restaurants in New York" → hasSpecificLocation: true, extractedLocation: "New York, NY", strippedQuery: "restaurants", optimizedQuery: "restaurants"
"divorce lawyers near 90210" → hasSpecificLocation: true, extractedLocation: "90210", strippedQuery: "divorce lawyers", optimizedQuery: "divorce attorney"
"investment banking firms" → hasSpecificLocation: false, strippedQuery: "investment banking firms", optimizedQuery: "investment banks"
"real estate agents in chicago" → hasSpecificLocation: true, extractedLocation: "Chicago, IL", strippedQuery: "real estate agents", optimizedQuery: "real estate"
"financial advisors" → hasSpecificLocation: false, strippedQuery: "financial advisors", optimizedQuery: "financial advisor"`,
      });

      this.log(
        "INFO",
        `AI Location analysis result: hasSpecificLocation=${result.object.hasSpecificLocation}, extractedLocation="${result.object.extractedLocation}", optimizedQuery="${result.object.optimizedQuery}", reasoning="${result.object.reasoning}"`
      );
      return result.object;
    } catch (error) {
      this.log(
        "ERROR",
        `AI location analysis failed: ${error}. Cannot proceed without AI analysis.`
      );
      
      // Return a basic fallback without manual pattern matching
      return {
        hasSpecificLocation: false,
        strippedQuery: query,
        optimizedQuery: query,
        reasoning: "AI analysis failed - using original query"
      };
    }
  }

  private async getLocationFromIP(ipAddress?: string): Promise<string> {
    try {
      this.log(
        "INFO",
        `Getting location from IP: ${ipAddress || "auto-detect"}`
      );

      // Handle localhost/private IP addresses
      if (!ipAddress || ipAddress === "::1" || ipAddress === "127.0.0.1" || ipAddress.startsWith("192.168.") || ipAddress.startsWith("10.") || ipAddress.startsWith("172.")) {
        this.log("INFO", "Localhost or private IP detected, using default US location");
        return "United States";
      }

      // Use ipapi.co for IP geolocation (free tier allows reasonable usage)
      const url = ipAddress
        ? `https://ipapi.co/${ipAddress}/json/`
        : `https://ipapi.co/json/`;

      const response = await axios.get(url, {
        timeout: 10000, // Increased timeout
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; YellowPagesScraper/1.0)",
        },
      });

      const data = response.data;
      this.log("INFO", `IP API response: ${JSON.stringify(data)}`);

      // Check for API errors
      if (data.error) {
        this.log("WARNING", `IP API error: ${data.reason || data.error}`);
        return "United States";
      }

      if (data.city && data.region_code) {
        const location = `${data.city}, ${data.region_code}`;
        this.log("INFO", `Detected location from IP: ${location}`);
        return location;
      } else if (data.city && data.region) {
        const location = `${data.city}, ${data.region}`;
        this.log("INFO", `Detected location from IP: ${location}`);
        return location;
      } else if (data.postal) {
        this.log("INFO", `Detected ZIP from IP: ${data.postal}`);
        return data.postal;
      } else if (data.region_code) {
        this.log("INFO", `Detected state from IP: ${data.region_code}`);
        return data.region_code;
      } else {
        this.log(
          "WARNING",
          `Could not determine location from IP, using default. Data: ${JSON.stringify(
            data
          )}`
        );
        return "United States";
      }
    } catch (error) {
      this.log(
        "WARNING",
        `IP geolocation failed: ${error}, using default location`
      );
      return "United States";
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generatePlaceId(name: string, address: string): string {
    const combined = `${name}_${address}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    return `yp_${combined.substring(0, 50)}_${Date.now() % 100000}`;
  }

  private normalizeWebsite(website?: string): string {
    if (!website) return "";

    try {
      let url = website.trim();

      // Remove Yellow Pages internal links
      if (url.includes("yellowpages.com") || url.includes("yp.com")) {
        return "";
      }

      // Add protocol if missing
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

  private async createSession(): Promise<string | null> {
    try {
      this.log("INFO", "Creating FlareSolverr session...");

      const response = await axios.post(`${this.flaresolverrUrl}/v1`, {
        cmd: "sessions.create",
        maxTimeout: 60000,
      });

      if (response.data.status === "ok") {
        this.sessionId = response.data.session;
        this.log("INFO", `Session created: ${this.sessionId}`);
        return this.sessionId || null;
      } else {
        this.log("ERROR", `Failed to create session: ${response.data.message}`);
        return null;
      }
    } catch (error) {
      this.log("ERROR", `Session creation failed: ${error}`);
      return null;
    }
  }

  private async destroySession(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await axios.post(`${this.flaresolverrUrl}/v1`, {
        cmd: "sessions.destroy",
        session: this.sessionId,
      });
      this.log("INFO", `Session destroyed: ${this.sessionId}`);
      this.sessionId = undefined;
    } catch (error) {
      this.log("WARNING", `Failed to destroy session: ${error}`);
    }
  }

  private async makeRequest(url: string): Promise<string | null> {
    try {
      this.log("INFO", `Making FlareSolverr request to: ${url}`);

      const requestData: Record<string, unknown> = {
        cmd: "request.get",
        url: url,
        maxTimeout: 60000,
      };

      // Use session if available
      if (this.sessionId) {
        requestData.session = this.sessionId;
      }

      const response = await axios.post(
        `${this.flaresolverrUrl}/v1`,
        requestData
      );
      const flareResponse: FlareSolverrResponse = response.data;

      if (
        flareResponse.status === "ok" &&
        flareResponse.solution.status === 200
      ) {
        this.log(
          "INFO",
          `Request successful, received ${flareResponse.solution.response.length} characters`
        );
        return flareResponse.solution.response;
      } else {
        this.log(
          "ERROR",
          `Request failed: ${flareResponse.message || "Unknown error"}`
        );
        return null;
      }
    } catch (error) {
      this.log("ERROR", `FlareSolverr request failed: ${error}`);
      return null;
    }
  }

  private extractListingData(
    $: cheerio.CheerioAPI,
    listing: any
  ): YellowPagesListing | null {
    const $listing = $(listing);

    try {
      // Extract basic info using multiple selectors for robustness
      let name = $listing
        .find(
          ".business-name, .n, h3 a, .listing-name, .srp-business-name, .business-name a"
        )
        .first()
        .text()
        .trim();

      if (!name) return null;

      // Clean up name - remove leading numbers and dots
      name = name.replace(/^\d+\.\s*/, "").trim();

      // Skip if this looks like a partial or nested element
      if (name.length < 3) return null;

      // Extract address components separately for better formatting
      let address = "";

      // Try to get full address first
      const fullAddress = $listing
        .find(".adr, .address, .listing-address, .srp-address")
        .first()
        .text()
        .trim();

      if (fullAddress) {
        address = fullAddress;
      } else {
        // Build address from components
        const streetAddress = $listing
          .find(".street-address, .street")
          .first()
          .text()
          .trim();
        const locality = $listing
          .find(".locality, .city")
          .first()
          .text()
          .trim();
        const region = $listing.find(".region, .state").first().text().trim();
        const postalCode = $listing
          .find(".postal-code, .zip")
          .first()
          .text()
          .trim();

        // Combine address parts with proper spacing
        const addressParts = [];
        if (streetAddress) addressParts.push(streetAddress);

        const cityStateZip = [];
        if (locality) cityStateZip.push(locality);
        if (region) cityStateZip.push(region);
        if (postalCode) cityStateZip.push(postalCode);

        if (cityStateZip.length > 0) {
          addressParts.push(cityStateZip.join(", "));
        }

        address = addressParts.join(", ");
      }

      // Clean up address formatting issues
      address = address
        .replace(/([a-z])([A-Z])/g, "$1, $2") // Add comma between lowercase and uppercase
        .replace(/(\d{5})\s*,\s*([A-Z]{2})/g, "$2 $1") // Fix "12345, CO" to "CO 12345"
        .replace(/,\s*,/g, ",") // Remove double commas
        .replace(/^\s*,|,\s*$/g, "") // Remove leading/trailing commas
        .trim();

      const phone = $listing
        .find(".phone, .phones, .phone-number, .srp-phone, [data-phone]")
        .first()
        .text()
        .trim();

      // Look for website links (excluding internal Yellow Pages links)
      let website = "";
      const websiteLink = $listing
        .find('a[href*="http"]')
        .filter((_, el) => {
          const href = $(el).attr("href") || "";
          return (
            !href.includes("yellowpages.com") &&
            !href.includes("yp.com") &&
            !href.includes("maps.google.com") &&
            !href.includes("facebook.com") &&
            !href.includes("instagram.com") &&
            !href.includes("twitter.com")
          );
        })
        .first();

      if (websiteLink.length) {
        website = websiteLink.attr("href") || "";
      }

      // Extract rating info
      let reviewsCount = null;
      let reviewsAverage = null;

      const ratingText = $listing
        .find(".rating, .reviews, .review-count, .srp-rating, .count")
        .text();
      const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*stars?/i);
      const countMatch = ratingText.match(/(\d+)\s*reviews?/i);

      if (ratingMatch) {
        reviewsAverage = parseFloat(ratingMatch[1]);
      }
      if (countMatch) {
        reviewsCount = parseInt(countMatch[1], 10);
      }

      // Extract business category/type
      const placeType = $listing
        .find(
          ".categories, .category, .business-type, .srp-categories, .breadcrumb"
        )
        .first()
        .text()
        .trim();

      // Extract hours
      const hours = $listing
        .find(".hours, .business-hours, .open-hours, .srp-hours")
        .first()
        .text()
        .trim();

      // Extract description if available
      const description = $listing
        .find(".snippet, .description, .business-description, .srp-description")
        .first()
        .text()
        .trim();

      const listing_data: YellowPagesListing = {
        name,
        address,
        website: this.normalizeWebsite(website),
        phone_number: phone,
        reviews_count: reviewsCount,
        reviews_average: reviewsAverage,
        store_shopping: "Unknown",
        in_store_pickup: "Unknown",
        store_delivery: "Unknown",
        place_type: placeType,
        opens_at: hours,
        introduction: description,
        place_id: this.generatePlaceId(name, address),
      };

      return listing_data;
    } catch (error) {
      this.log("WARNING", `Failed to extract listing data: ${error}`);
      return null;
    }
  }

  async scrapeCompanies(
    searchFor: string,
    total: number = 20,
    specificLocation: string = "United States",
    onCompanyFound?: (company: YellowPagesListing) => void
  ): Promise<YellowPagesListing[]> {
    const companiesWithWebsites: YellowPagesListing[] = [];
    const seenCompanies = new Set<string>(); // Track seen companies to avoid duplicates
    let page = 1;
    let totalProcessed = 0;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmptyPages = 3; // Stop if we hit 3 empty pages in a row
    const maxTotalPages = 50; // Absolute maximum to prevent infinite loops

    this.log(
      "INFO",
      `Starting Yellow Pages search for "${searchFor}" in "${specificLocation}" - targeting ${total} companies WITH websites`
    );

    // Create session for efficiency
    const sessionCreated = await this.createSession();
    if (!sessionCreated) {
      this.log(
        "WARNING",
        "Failed to create session, continuing without session"
      );
    }

    try {
      while (companiesWithWebsites.length < total && page <= maxTotalPages && consecutiveEmptyPages < maxConsecutiveEmptyPages) {
        this.log("INFO", `Scraping page ${page}... (Found ${companiesWithWebsites.length}/${total} companies with websites)`);

        // Construct Yellow Pages search URL
        const searchQuery = encodeURIComponent(searchFor);
        const location = encodeURIComponent(specificLocation);
        const url = `https://www.yellowpages.com/search?search_terms=${searchQuery}&geo_location_terms=${location}&page=${page}`;

        this.log("INFO", `Constructed URL: ${url}`);

        // Use FlareSolverr to bypass protection
        const htmlContent = await this.makeRequest(url);

        if (!htmlContent) {
          this.log("WARNING", `Failed to fetch page ${page}, skipping`);
          consecutiveEmptyPages++;
          page++;
          continue;
        }

        const $ = cheerio.load(htmlContent);

        // Find listing containers - try specific selectors first
        let listings = $(".result.organic").toArray();

        // Fallback to other common Yellow Pages selectors
        if (listings.length === 0) {
          listings = $(".organic_div").toArray();
        }
        if (listings.length === 0) {
          listings = $(".result").toArray();
        }
        if (listings.length === 0) {
          listings = $(".business-card, .listing").toArray();
        }

        this.log("INFO", `Found ${listings.length} listings on page ${page}`);

        if (listings.length === 0) {
          consecutiveEmptyPages++;
          this.log(
            "WARNING",
            `No listings found on page ${page} (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages} consecutive empty pages)`
          );
          page++;
          continue;
        }

        // Reset consecutive empty pages counter
        consecutiveEmptyPages = 0;
        let pageCompaniesWithWebsites = 0;

        // Process each listing
        for (const listing of listings) {
          totalProcessed++;
          
          const company = this.extractListingData($, listing);

          if (company && company.name) {
            // Create a unique key for deduplication
            const companyKey = `${company.name
              .toLowerCase()
              .trim()}_${company.address.toLowerCase().trim()}`;

            // Skip if we've already seen this company
            if (seenCompanies.has(companyKey)) {
              this.log("WARNING", `Skipping duplicate: ${company.name}`);
              continue;
            }

            seenCompanies.add(companyKey);

            // Only add companies that have websites
            if (company.website && company.website.trim()) {
              companiesWithWebsites.push(company);
              pageCompaniesWithWebsites++;

              this.log(
                "INFO",
                `✓ Found company with website: ${company.name} - ${company.website} (${companiesWithWebsites.length}/${total})`
              );

              // Stream the company immediately if callback provided
              if (onCompanyFound) {
                onCompanyFound(company);
              }

              // Break if we've reached our target
              if (companiesWithWebsites.length >= total) {
                this.log("INFO", `Target of ${total} companies with websites reached!`);
                break;
              }
            } else {
              this.log("INFO", `✗ Skipping ${company.name} - no website`);
            }

            // Add a small delay between extractions to be respectful
            await this.delay(100);
          }
        }

        this.log("INFO", `Page ${page} summary: ${pageCompaniesWithWebsites} companies with websites added, ${totalProcessed} total processed`);

        // Add delay between pages
        if (companiesWithWebsites.length < total && page < maxTotalPages) {
          await this.delay(this.baseDelay + Math.random() * 2000);
        }

        page++;
      }
    } catch (error) {
      this.log("ERROR", `Scraping failed: ${error}`);
    } finally {
      // Clean up session
      await this.destroySession();
    }

    this.log(
      "INFO",
      `Yellow Pages scraping completed. Found ${companiesWithWebsites.length} companies with websites out of ${totalProcessed} total companies processed.`
    );
    
    if (companiesWithWebsites.length < total) {
      this.log("WARNING", `Only found ${companiesWithWebsites.length} companies with websites, requested ${total}. This may be due to limited available companies with websites in the search results.`);
    }
    
    return companiesWithWebsites;
  }

  // Intelligent scraping method that uses AI to determine location, with IP fallback
  async scrapeCompaniesIntelligent(
    searchQuery: string,
    total: number = 20,
    onCompanyFound?: (company: YellowPagesListing) => void,
    userIP?: string
  ): Promise<YellowPagesListing[]> {
    this.log("INFO", `Starting intelligent search for: "${searchQuery}"`);

    // First, analyze the query to see if location is mentioned
    const locationAnalysis = await this.analyzeLocationRequest(searchQuery);

    let searchLocation: string;

    if (
      locationAnalysis.hasSpecificLocation &&
      locationAnalysis.extractedLocation
    ) {
      // Use the location found in the query
      searchLocation = locationAnalysis.extractedLocation;
      this.log("INFO", `Using location from query: ${searchLocation}`);
    } else {
      // Fall back to IP-based location
      searchLocation = await this.getLocationFromIP(userIP);
      this.log("INFO", `Using IP-based location: ${searchLocation}`);
    }

    // Use the AI-optimized query for better Yellow Pages results
    const optimizedSearchTerm = locationAnalysis.optimizedQuery;
    
    this.log(
      "INFO",
      `Search strategy: Single location - ${locationAnalysis.reasoning}`
    );
    this.log("INFO", `Original query: "${searchQuery}"`);
    this.log("INFO", `Optimized search term: "${optimizedSearchTerm}"`);
    this.log("INFO", `Final search location: ${searchLocation}`);

    // Use optimized query for scraping
    return await this.scrapeCompanies(
      optimizedSearchTerm,
      total,
      searchLocation,
      onCompanyFound
    );
  }
}

export { YellowPagesFlareSolverrScraper };
export type { YellowPagesListing };
