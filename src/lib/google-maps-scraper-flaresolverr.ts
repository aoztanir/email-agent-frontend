import axios from "axios";
import * as cheerio from "cheerio";

interface Place {
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

class GoogleMapsFlareSolverrScraper {
  private flaresolverrUrl: string;
  private baseDelay: number;
  private sessionId?: string;

  constructor(flaresolverrUrl: string = "http://localhost:8191") {
    this.flaresolverrUrl = flaresolverrUrl;
    this.baseDelay = 2000;
    this.setupLogging();
  }

  private setupLogging(): void {
    console.log("Google Maps FlareSolverr Scraper initialized");
  }

  private log(level: "INFO" | "WARNING" | "ERROR", message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${level} - ${message}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generatePlaceId(name: string, address: string): string {
    const combined = `${name}_${address}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    return `gm_${combined.substring(0, 50)}_${Date.now() % 100000}`;
  }

  private normalizeWebsite(website?: string): string {
    if (!website) return "";

    try {
      let url = website.trim();

      if (url.includes("google.com") || url.includes("maps.google.com")) {
        return "";
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const parsed = new URL(url);
      let domain = parsed.hostname.toLowerCase();

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

  extractPlaceIdFromUrl(url: string): string {
    try {
      const placeIdMatch = url.match(/1s([A-Za-z0-9_-]+)/);
      if (placeIdMatch) {
        return placeIdMatch[1];
      }

      const placeMatch = url.match(/\/place\/([^/@]+)/);
      if (placeMatch) {
        return placeMatch[1].replace(/\+/g, "_");
      }

      const urlParts = url.split("/");
      return urlParts.length > 0 ? urlParts[urlParts.length - 1] : url;
    } catch (e) {
      this.log("WARNING", `Failed to extract place_id from URL ${url}: ${e}`);
      return `unknown_${Math.abs(this.hashCode(url) % 1000000)}`;
    }
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  private extractPlaceData($: cheerio.CheerioAPI, listing: any): Place | null {
    const $listing = $(listing);

    try {
      // Extract business name using multiple selectors
      let name = $listing
        .find('div[data-value="Name"], .qBF1Pd, .NrDZNb, .fontHeadlineSmall')
        .first()
        .text()
        .trim();

      // Fallback selectors for name
      if (!name) {
        name = $listing
          .find('h3, .DUwDvf, [role="img"][aria-label*="star"]')
          .closest("div")
          .find("span")
          .first()
          .text()
          .trim();
      }

      if (!name || name.length < 2) return null;

      // Extract address
      let address = $listing
        .find('[data-value="Address"], .W4Efsd:contains("·")')
        .first()
        .text()
        .trim();

      // Clean up address formatting
      if (address) {
        address = address.replace(/^[0-9]+\.\s*/, "").trim();
      }

      // Extract website
      let website = "";
      const websiteLink = $listing.find('a[href*="http"]').first();
      if (websiteLink.length) {
        const href = websiteLink.attr("href") || "";
        if (!href.includes("google.com") && !href.includes("maps.google.com")) {
          website = href;
        }
      }

      // Extract phone number
      const phone = $listing
        .find('[data-value="Phone number"], .UsdlK')
        .first()
        .text()
        .trim();

      // Extract rating and reviews
      let reviewsCount = null;
      let reviewsAverage = null;

      const ratingText =
        $listing.find('[role="img"][aria-label*="star"]').attr("aria-label") ||
        "";
      const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*stars?/);
      const reviewMatch = ratingText.match(/(\d+)\s*reviews?/);

      if (ratingMatch) {
        reviewsAverage = parseFloat(ratingMatch[1]);
      }
      if (reviewMatch) {
        reviewsCount = parseInt(reviewMatch[1], 10);
      }

      // Extract business type/category
      const placeType = $listing
        .find('.W4Efsd:not(:contains("·")), .fontBodyMedium')
        .first()
        .text()
        .trim();

      // Extract hours if available
      const hours = $listing
        .find('[data-value="Hours"], .ZDu9vd')
        .first()
        .text()
        .trim();

      // Generate place ID
      const placeId = this.generatePlaceId(name, address);

      const place: Place = {
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
        introduction: "",
        place_id: placeId,
      };

      return place;
    } catch (error) {
      this.log("WARNING", `Failed to extract place data: ${error}`);
      return null;
    }
  }

  async scrapeCompanies(
    searchFor: string,
    total: number = 20,
    specificLocation: string = "United States",
    onCompanyFound?: (company: Place) => void
  ): Promise<Place[]> {
    const places: Place[] = [];
    const seenPlaces = new Set<string>();
    let pageToken = "";
    let attemptCount = 0;
    const maxAttempts = 10;

    this.log(
      "INFO",
      `Starting Google Maps API search for "${searchFor}" in "${specificLocation}"`
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
      while (places.length < total && attemptCount < maxAttempts) {
        attemptCount++;
        this.log("INFO", `API request attempt ${attemptCount}...`);

        // Use a simpler Google Maps search URL that returns HTML we can parse
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchFor)}`;
        this.log("INFO", `Constructed search URL: ${searchUrl}`);

        // Use FlareSolverr to make the request
        const responseText = await this.makeRequest(searchUrl);

        if (!responseText) {
          this.log("WARNING", `Failed to fetch API response, attempt ${attemptCount}`);
          await this.delay(2000);
          continue;
        }

        // Parse the HTML response using Cheerio
        const $ = cheerio.load(responseText);
        const newPlaces = this.extractPlacesFromHTML($, seenPlaces, total - places.length);
        
        if (newPlaces.length === 0) {
          this.log("WARNING", `No places found in HTML response, attempt ${attemptCount}`);
          
          // Try query variations if we haven't reached the target
          if (places.length < total) {
            const variations = this.getQueryVariations(searchFor);
            if (variations.length > 0 && attemptCount <= maxAttempts) {
              searchFor = variations[Math.min(attemptCount - 1, variations.length - 1)];
              this.log("INFO", `Trying query variation: "${searchFor}"`);
            }
          }
          continue;
        }

        // Process the places from the HTML
        let newPlacesCount = 0;
        for (const place of newPlaces) {
          if (places.length >= total) break;

          if (place && place.name) {
            // Create a unique key for deduplication
            const placeKey = `${place.name.toLowerCase().trim()}_${place.address.toLowerCase().trim()}`;

            // Skip if we've already seen this place
            if (seenPlaces.has(placeKey)) {
              this.log("WARNING", `Skipping duplicate: ${place.name}`);
              continue;
            }

            seenPlaces.add(placeKey);
            places.push(place);
            newPlacesCount++;

            this.log(
              "INFO",
              `Extracted: ${place.name} (${places.length}/${total})`
            );

            // Stream the place immediately if callback provided
            if (onCompanyFound) {
              onCompanyFound(place);
            }
          }
        }

        // If no new places were added, try different query variations
        if (newPlacesCount === 0) {
          this.log("INFO", `No new results from current query. Found ${places.length}/${total} places so far.`);
          
          // Try query variations if we haven't reached the target
          if (places.length < total) {
            const variations = this.getQueryVariations(searchFor);
            if (variations.length > 0 && attemptCount <= maxAttempts) {
              searchFor = variations[Math.min(attemptCount - 1, variations.length - 1)];
              this.log("INFO", `Trying query variation: "${searchFor}"`);
            }
          }
        }

        // Add delay between requests
        await this.delay(1500 + Math.random() * 1000);
      }
    } catch (error) {
      this.log("ERROR", `API scraping failed: ${error}`);
    } finally {
      // Clean up session
      await this.destroySession();
    }

    this.log(
      "INFO",
      `Google Maps API scraping completed. Found ${places.length} unique places after ${attemptCount} attempts.`
    );
    return places;
  }

  private buildGoogleMapsApiUrl(query: string, location: string, pageToken: string = ""): string {
    // Use the exact URL structure from your curl request
    const baseUrl = "https://www.google.com/search";
    
    // Build the pb parameter using the exact structure from the curl
    const pbParam = this.buildFullPbParameter(query, location, pageToken);
    
    const params = new URLSearchParams({
      tbm: "map",
      authuser: "0", 
      hl: "en",
      gl: "us",
      pb: pbParam,
      q: query,
      oq: query,
      gs_l: "maps.12..38i39i111i426k1j38i426k1l3j38i72k1.10561.11079.1.13718.5.5.....73.276.4.4.....0....1..maps..1.4.290.0..38i39k1j38j38i376k1j38i444k1j38i377k1.",
      tch: "1",
      ech: "1",
      psi: `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private buildFullPbParameter(query: string, location: string, pageToken: string = ""): string {
    // Use the exact pb parameter structure from your curl request
    // This is the full parameter that Google Maps uses internally
    const coords = this.getLocationCoords(location);
    
    let pb = "!4m12!1m3" +
      `!1d${coords.bounds}` +
      `!2d${coords.lng}` + 
      `!3d${coords.lat}` +
      "!2m3!1f0!2f0!3f0!3m2!1i958!2i1049!4f13.1!7i20!10b1" +
      "!12m23!1m5!18b1!30b1!31m1!1b1!34e1!2m3!5m1!6e2!20e3!10b1!12b1!13b1!16b1!17m1!3e1!20m3!5e2!6b1!14b1!46m1!1b0!96b1" +
      "!19m4!2m3!1i360!2i120!4i8!20m65!2m2!1i203!2i100!3m2!2i4!5b1!6m6!1m2!1i86!2i86!1m2!1i408!2i240" +
      "!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e4!1m3!1e9!2b1!3e2!2b1!9b0" +
      "!15m16!1m7!1m2!1m1!1e2!2m2!1i195!2i195!3i20!1m7!1m2!1m1!1e2!2m2!1i195!2i195!3i20";

    if (pageToken) {
      pb += `!22m6!1s${pageToken}!2s1i%3A0%2Ct%3A11887%2Cp%3A${pageToken}!7e81!12e3!17s${pageToken}!18e15`;
    }

    pb += "!24m112!1m32!13m9!2b1!3b1!4b1!6i1!8b1!9b1!14b1!20b1!25b1" +
      "!18m21!3b1!4b1!5b1!6b1!9b1!12b1!13b1!14b1!17b1!20b1!21b1!22b1!25b1!27m1!1b0!28b0!32b1!33m1!1b1!34b1!36e2" +
      "!10m1!8e3!11m1!3e1!14m1!3b0!17b1!20m2!1e3!1e6!24b1!25b1!26b1!27b1!29b1!30m1!2b1!36b1!37b1!39m3!2m2!2i1!3i1!43b1!52b1!54m1!1b1!55b1!56m1!1b1!61m2!1m1!1e1" +
      "!65m5!3m4!1m3!1m2!1i224!2i298!72m22!1m8!2b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!4b1" +
      "!8m10!1m6!4m1!1e1!4m1!1e3!4m1!1e4!3sother_user_google_review_posts__and__hotel_and_vr_partner_review_posts!6m1!1e1!9b1!89b1" +
      "!98m3!1b1!2b1!3b1!103b1!113b1!114m3!1b1!2m1!1b1!117b1!122m1!1b1!125b0!126b1!127b1" +
      "!26m4!2m3!1i80!2i92!4i8!30m28!1m6!1m2!1i0!2i0!2m2!1i530!2i1049!1m6!1m2!1i908!2i0!2m2!1i958!2i1049!1m6!1m2!1i0!2i0!2m2!1i958!2i20!1m6!1m2!1i0!2i1029!2m2!1i958!2i1049" +
      "!34m19!2b1!3b1!4b1!6b1!8m6!1b1!3b1!4b1!5b1!6b1!7b1!9b1!12b1!14b1!20b1!23b1!25b1!26b1!31b1!37m1!1e81!42b1!47m0" +
      "!49m10!3b1!6m2!1b1!2b1!7m2!1e3!2b1!8b1!9b1!10e2!50m4!2e2!3m2!1b1!3b1!67m5!7b1!10b1!14b1!15m1!1b0!69i745";

    return pb;
  }

  private getLocationCoords(location: string): { lat: number, lng: number, bounds: number } {
    // Default to US coordinates if no specific location
    const defaultCoords = { lat: 39.8283, lng: -98.5795, bounds: 17657.104902925337 };
    
    // You could expand this to do actual geocoding for better results
    const locationMap: Record<string, typeof defaultCoords> = {
      "United States": defaultCoords,
      "New York": { lat: 40.7128, lng: -74.0060, bounds: 5000 },
      "Los Angeles": { lat: 34.0522, lng: -118.2437, bounds: 5000 },
      "Chicago": { lat: 41.8781, lng: -87.6298, bounds: 5000 },
    };

    return locationMap[location] || defaultCoords;
  }

  private async makeGoogleMapsApiRequest(url: string): Promise<string | null> {
    const headers = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "dnt": "1",
      "priority": "u=1, i",
      "referer": "https://www.google.com/",
      "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "x-client-data": "CML3ygE=",
      "x-maps-diversion-context-bin": "CAE=",
      // Add basic cookies that might be needed (simplified from your curl)
      "cookie": "OTZ=8214612_84_88_104280_84_446940; SEARCH_SAMESITE=CgQI354B; AEC=AVh_V2izSpRYllE9Bt8ZCFIxJnzv9nITqhvxnfrG6QplOcOqTsIOdkrt7g"
    };

    try {
      this.log("INFO", `Making Google Maps API request to: ${url}`);

      const requestData: Record<string, unknown> = {
        cmd: "request.get",
        url: url,
        maxTimeout: 60000,
        headers: headers
      };

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
          `API request successful, received ${flareResponse.solution.response.length} characters`
        );
        return flareResponse.solution.response;
      } else {
        this.log(
          "ERROR",
          `API request failed: ${flareResponse.message || "Unknown error"}`
        );
        return null;
      }
    } catch (error) {
      this.log("ERROR", `Google Maps API request failed: ${error}`);
      return null;
    }
  }

  private parseGoogleMapsApiResponse(responseText: string): { places: any[], nextPageToken?: string } | null {
    try {
      // Log first part of response to debug the format
      this.log("INFO", `Response starts with: ${responseText.substring(0, 100)}...`);
      
      let jsonData: any = null;
      
      // Try different response formats
      // Format 1: Standard JSONP with )]}' prefix
      const jsonpMatch = responseText.match(/^\)\]\}'\s*\n([\s\S]*)$/);
      if (jsonpMatch) {
        this.log("INFO", "Found JSONP format response");
        jsonData = JSON.parse(jsonpMatch[1]);
      } else {
        // Format 2: Look for JSON arrays in the response
        const jsonArrayMatch = responseText.match(/(\[\[[\s\S]*\]\])/);
        if (jsonArrayMatch) {
          this.log("INFO", "Found JSON array format response");
          jsonData = JSON.parse(jsonArrayMatch[1]);
        } else {
          // Format 3: Try to parse as direct JSON
          try {
            jsonData = JSON.parse(responseText);
            this.log("INFO", "Parsed as direct JSON");
          } catch {
            // Format 4: Look for any JSON-like structure
            const anyJsonMatch = responseText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (anyJsonMatch) {
              this.log("INFO", "Found JSON-like structure");
              jsonData = JSON.parse(anyJsonMatch[1]);
            } else {
              this.log("WARNING", "No recognizable JSON format found in response");
              return null;
            }
          }
        }
      }
      
      if (!jsonData) {
        this.log("WARNING", "Could not extract JSON data from API response");
        return null;
      }

      // The response structure is quite complex and nested
      // We need to navigate through the nested arrays to find the place data
      const places = this.extractPlacesFromApiData(jsonData);
      
      // Look for next page token if available
      const nextPageToken = this.extractNextPageToken(jsonData);

      this.log("INFO", `Parsed ${places.length} places from API response`);
      
      return {
        places,
        nextPageToken
      };

    } catch (error) {
      this.log("ERROR", `Failed to parse API response: ${error}`);
      // Log more details about the response for debugging
      this.log("ERROR", `Response length: ${responseText.length}, starts with: "${responseText.substring(0, 200)}"`);
      return null;
    }
  }

  private extractPlacesFromApiData(data: any): any[] {
    const places: any[] = [];
    
    try {
      // Navigate through the nested structure to find places
      // The exact structure may vary, so we'll try multiple paths
      
      if (Array.isArray(data) && data.length > 0) {
        // Try to find the section containing place data
        for (const section of data) {
          if (Array.isArray(section)) {
            for (const subsection of section) {
              if (Array.isArray(subsection)) {
                const extractedPlaces = this.extractPlacesFromNestedArray(subsection);
                places.push(...extractedPlaces);
              }
            }
          }
        }
      }

    } catch (error) {
      this.log("WARNING", `Error extracting places from API data: ${error}`);
    }

    return places;
  }

  private extractPlacesFromNestedArray(arr: any[]): any[] {
    const places: any[] = [];
    
    for (const item of arr) {
      if (Array.isArray(item) && item.length > 10) {
        // This looks like a place entry based on the structure
        const place = {
          name: this.safeGet(item, [14, 0, 0]) || this.safeGet(item, [11, 0]),
          address: this.safeGet(item, [14, 2, 0]) || this.safeGet(item, [2, 0]),
          phone: this.safeGet(item, [14, 178, 0, 0]) || this.safeGet(item, [178, 0, 0]),
          website: this.safeGet(item, [14, 7, 0]) || this.safeGet(item, [7, 0]),
          rating: this.safeGet(item, [14, 4, 7]) || this.safeGet(item, [4, 7]),
          reviewCount: this.safeGet(item, [14, 4, 8]) || this.safeGet(item, [4, 8]),
          placeId: this.safeGet(item, [14, 10]) || this.safeGet(item, [10]),
          coordinates: {
            lat: this.safeGet(item, [14, 9, 2]) || this.safeGet(item, [9, 2]),
            lng: this.safeGet(item, [14, 9, 3]) || this.safeGet(item, [9, 3])
          }
        };

        if (place.name) {
          places.push(place);
        }
      }
    }

    return places;
  }

  private safeGet(obj: any, path: number[]): any {
    let current = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    return current;
  }

  private extractNextPageToken(data: any): string | undefined {
    // Look for pagination token in the response
    // This would be implementation-specific based on the actual response structure
    try {
      // The next page token is usually buried deep in the response structure
      // We'll need to search through the nested arrays for it
      const searchForToken = (obj: any): string | undefined => {
        if (typeof obj === 'string' && obj.length > 20 && obj.includes(':')) {
          return obj;
        }
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const token = searchForToken(item);
            if (token) return token;
          }
        }
        return undefined;
      };

      return searchForToken(data);
    } catch (error) {
      this.log("WARNING", `Could not extract next page token: ${error}`);
      return undefined;
    }
  }

  private convertApiPlaceToPlace(apiPlace: any): Place | null {
    try {
      const place: Place = {
        name: apiPlace.name || "",
        address: apiPlace.address || "",
        website: this.normalizeWebsite(apiPlace.website),
        phone_number: apiPlace.phone || "",
        reviews_count: apiPlace.reviewCount ? parseInt(apiPlace.reviewCount) : null,
        reviews_average: apiPlace.rating ? parseFloat(apiPlace.rating) : null,
        store_shopping: "Unknown",
        in_store_pickup: "Unknown",
        store_delivery: "Unknown",
        place_type: "",
        opens_at: "",
        introduction: "",
        place_id: apiPlace.placeId || this.generatePlaceId(apiPlace.name || "", apiPlace.address || ""),
      };

      return place;
    } catch (error) {
      this.log("WARNING", `Failed to convert API place to Place: ${error}`);
      return null;
    }
  }

  private extractPlacesFromHTML($: cheerio.CheerioAPI, seenPlaces: Set<string>, maxNew: number): Place[] {
    const places: Place[] = [];
    
    // Find business listing containers using various selectors for Google Maps
    let listings = $('[data-cid], [role="article"], .Nv2PK, .bfdHYd, .hfpxzc');
    
    // Fallback selectors 
    if (listings.length === 0) {
      listings = $('[jsaction*="click"], .result, .place-result, [data-value="Name"]').parent();
    }

    this.log("INFO", `Found ${listings.length} potential listings in HTML`);

    listings.each((_index, listing) => {
      if (places.length >= maxNew) return false;

      const place = this.extractPlaceDataFromHTML($, listing);

      if (place && place.name) {
        // Create a unique key for deduplication
        const placeKey = `${place.name.toLowerCase().trim()}_${place.address.toLowerCase().trim()}`;

        // Skip if we've already seen this place
        if (seenPlaces.has(placeKey)) {
          return;
        }

        places.push(place);
      }
    });

    this.log("INFO", `Extracted ${places.length} valid places from HTML`);
    return places;
  }

  private extractPlaceDataFromHTML($: cheerio.CheerioAPI, listing: any): Place | null {
    const $listing = $(listing);

    try {
      // Extract business name using Google Maps specific selectors
      let name = $listing.find('[data-value="Name"], .qBF1Pd, .fontHeadlineSmall').first().text().trim();
      
      // Fallback name selectors
      if (!name) {
        name = $listing.find('h3, .DUwDvf, [role="img"][aria-label*="star"]').closest('div').find('span').first().text().trim();
      }
      
      if (!name) {
        name = $listing.find('a[data-value="Name"]').text().trim();
      }

      if (!name || name.length < 2) return null;

      // Extract address
      let address = $listing.find('[data-value="Address"], .W4Efsd').first().text().trim();
      
      // Clean up address 
      if (address && address.includes('·')) {
        address = address.split('·')[0].trim();
      }

      // Extract website
      let website = "";
      const websiteLink = $listing.find('a[href*="http"]').first();
      if (websiteLink.length) {
        const href = websiteLink.attr("href") || "";
        if (!href.includes("google.com") && !href.includes("maps.google.com")) {
          website = href;
        }
      }

      // Extract phone number
      const phone = $listing.find('[data-value="Phone number"], .UsdlK').first().text().trim();

      // Extract rating and reviews from aria-label
      let reviewsCount = null;
      let reviewsAverage = null;

      const ratingText = $listing.find('[role="img"][aria-label*="star"]').attr("aria-label") || "";
      const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*stars?/);
      const reviewMatch = ratingText.match(/(\d+)\s*reviews?/);

      if (ratingMatch) {
        reviewsAverage = parseFloat(ratingMatch[1]);
      }
      if (reviewMatch) {
        reviewsCount = parseInt(reviewMatch[1], 10);
      }

      // Extract business type/category
      const placeType = $listing.find('.W4Efsd, .fontBodyMedium').first().text().trim();

      const place: Place = {
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
        opens_at: "",
        introduction: "",
        place_id: this.generatePlaceId(name, address),
      };

      return place;
    } catch (error) {
      this.log("WARNING", `Failed to extract place data from HTML: ${error}`);
      return null;
    }
  }

  private getQueryVariations(query: string): string[] {
    const variations = [];
    
    // Singular/plural variations
    if (query.endsWith('s')) {
      variations.push(query.slice(0, -1));
    } else {
      variations.push(query + 's');
    }
    
    // Common business term variations
    const termMap = {
      'restaurant': ['dining', 'food', 'eatery'],
      'lawyer': ['attorney', 'legal'],
      'doctor': ['physician', 'medical'],
      'store': ['shop', 'retail'],
      'company': ['business', 'firm'],
    };
    
    for (const [term, alternatives] of Object.entries(termMap)) {
      if (query.toLowerCase().includes(term)) {
        for (const alt of alternatives) {
          variations.push(query.replace(new RegExp(term, 'gi'), alt));
        }
        break;
      }
    }
    
    return variations.slice(0, 2);
  }
}

export { GoogleMapsFlareSolverrScraper };
export type { Place };
