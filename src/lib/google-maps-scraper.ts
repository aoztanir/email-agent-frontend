import { chromium, Browser, Page } from "playwright";
import * as os from "os";

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

class GoogleMapsScraper {
  constructor() {
    this.setupLogging();
  }

  private setupLogging(): void {
    // Simple logging setup - in a real app you might want to use a proper logging library
    console.log("Google Maps Scraper initialized");
  }

  private log(level: "INFO" | "WARNING" | "ERROR", message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${level} - ${message}`);
  }

  extractPlaceIdFromUrl(url: string): string {
    try {
      // Google Maps URLs contain place IDs in various formats
      // Example: /place/Name/@lat,lng,zoom/data=!3m1!4b1!4m6!3m5!1s[PLACE_ID]

      // Look for place ID pattern in URL
      const placeIdMatch = url.match(/1s([A-Za-z0-9_-]+)/);
      if (placeIdMatch) {
        return placeIdMatch[1];
      }

      // Fallback: extract from /place/ path
      const placeMatch = url.match(/\/place\/([^/@]+)/);
      if (placeMatch) {
        return placeMatch[1].replace(/\+/g, "_");
      }

      // Last resort: use a portion of the URL as identifier
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
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private async extractText(page: Page, xpath: string): Promise<string> {
    try {
      const element = page.locator(`xpath=${xpath}`);
      const count = await element.count();
      if (count > 0) {
        return await element.innerText();
      }
    } catch (e) {
      this.log("WARNING", `Failed to extract text for xpath ${xpath}: ${e}`);
    }
    return "";
  }

  private async extractPlace(page: Page): Promise<Place> {
    // XPaths
    const nameXpath = '//div[@class="TIHn2 "]//h1[@class="DUwDvf lfPIob"]';
    const addressXpath =
      '//button[@data-item-id="address"]//div[contains(@class, "fontBodyMedium")]';
    const websiteXpath =
      '//a[@data-item-id="authority"]//div[contains(@class, "fontBodyMedium")]';
    const phoneNumberXpath =
      '//button[contains(@data-item-id, "phone:tel:")]//div[contains(@class, "fontBodyMedium")]';
    const reviewsCountXpath =
      '//div[@class="TIHn2 "]//div[@class="fontBodyMedium dmRWX"]//div//span//span//span[@aria-label]';
    const reviewsAverageXpath =
      '//div[@class="TIHn2 "]//div[@class="fontBodyMedium dmRWX"]//div//span[@aria-hidden]';
    const info1 = '//div[@class="LTs0Rc"][1]';
    const info2 = '//div[@class="LTs0Rc"][2]';
    const info3 = '//div[@class="LTs0Rc"][3]';
    const opensAtXpath =
      '//button[contains(@data-item-id, "oh")]//div[contains(@class, "fontBodyMedium")]';
    const opensAtXpath2 =
      '//div[@class="MkV9"]//span[@class="ZDu9vd"]//span[2]';
    const placeTypeXpath = '//div[@class="LBgpqf"]//button[@class="DkEaL "]';
    const introXpath =
      '//div[@class="WeS02d fontBodyMedium"]//div[@class="PYvSYb "]';

    const place: Place = {
      name: "",
      address: "",
      website: "",
      phone_number: "",
      reviews_count: null,
      reviews_average: null,
      store_shopping: "No",
      in_store_pickup: "No",
      store_delivery: "No",
      place_type: "",
      opens_at: "",
      introduction: "",
      place_id: "",
    };

    place.name = await this.extractText(page, nameXpath);
    place.address = await this.extractText(page, addressXpath);
    place.website = await this.extractText(page, websiteXpath);
    place.phone_number = await this.extractText(page, phoneNumberXpath);
    place.place_type = await this.extractText(page, placeTypeXpath);
    place.introduction =
      (await this.extractText(page, introXpath)) || "None Found";

    // Reviews Count
    const reviewsCountRaw = await this.extractText(page, reviewsCountXpath);
    if (reviewsCountRaw) {
      try {
        const temp = reviewsCountRaw
          .replace(/\u00A0/g, "")
          .replace(/[()]/g, "")
          .replace(/,/g, "");
        place.reviews_count = parseInt(temp, 10);
      } catch (e) {
        this.log("WARNING", `Failed to parse reviews count: ${e}`);
      }
    }

    // Reviews Average
    const reviewsAvgRaw = await this.extractText(page, reviewsAverageXpath);
    if (reviewsAvgRaw) {
      try {
        const temp = reviewsAvgRaw.replace(/\s/g, "").replace(/,/g, ".");
        place.reviews_average = parseFloat(temp);
      } catch (e) {
        this.log("WARNING", `Failed to parse reviews average: ${e}`);
      }
    }

    // Store Info
    const infoXpaths = [info1, info2, info3];
    for (let idx = 0; idx < infoXpaths.length; idx++) {
      const infoRaw = await this.extractText(page, infoXpaths[idx]);
      if (infoRaw) {
        const temp = infoRaw.split("·");
        if (temp.length > 1) {
          const check = temp[1].replace(/\n/g, "").toLowerCase();
          if (check.includes("shop")) {
            place.store_shopping = "Yes";
          }
          if (check.includes("pickup")) {
            place.in_store_pickup = "Yes";
          }
          if (check.includes("delivery")) {
            place.store_delivery = "Yes";
          }
        }
      }
    }

    // Opens At
    let opensAtRaw = await this.extractText(page, opensAtXpath);
    if (opensAtRaw) {
      const opens = opensAtRaw.split("⋅");
      if (opens.length > 1) {
        place.opens_at = opens[1].replace(/\u202f/g, "");
      } else {
        place.opens_at = opensAtRaw.replace(/\u202f/g, "");
      }
    } else {
      const opensAt2Raw = await this.extractText(page, opensAtXpath2);
      if (opensAt2Raw) {
        const opens = opensAt2Raw.split("⋅");
        if (opens.length > 1) {
          place.opens_at = opens[1].replace(/\u202f/g, "");
        } else {
          place.opens_at = opensAt2Raw.replace(/\u202f/g, "");
        }
      }
    }

    return place;
  }

  async scrapeCompanies(
    searchFor: string,
    total: number = 20,
    specificLocation?: string,
    onCompanyFound?: (company: Place) => void
  ): Promise<Place[]> {
    const places: Place[] = [];

    let browser: Browser | null = null;
    try {
      // Browser configuration
      let browserPath: string | undefined;
      if (os.platform() === "win32") {
        browserPath =
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      }

      browser = await chromium.launch({
        executablePath: browserPath,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      const page = await browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      // If specific location provided, use it; otherwise start with a broader view
      const startUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        searchFor
      )}/@${specificLocation},15z`;

      await page.goto(startUrl, { timeout: 60000 });
      await page.waitForTimeout(2000);

      // Clear and enter search query
      const searchInput = page.locator("input#searchboxinput");
      await searchInput.click();
      await searchInput.fill("");
      await page.waitForTimeout(500);
      await searchInput.fill(searchFor);
      await page.keyboard.press("Enter");

      // Wait for results to load
      await page.waitForSelector(
        '//a[contains(@href, "https://www.google.com/maps/place")]',
        { timeout: 15000 }
      );
      await page.waitForTimeout(2000);

      let previouslyCountedA = 0;
      let stagnantCount = 0;
      const maxStagnantIterations = 1;

      while (true) {
        // Scroll more aggressively and in different patterns
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 5000);
          await page.waitForTimeout(800);
        }

        // Also try scrolling the results panel specifically
        const resultsPanel = page.locator('[role="main"]').first();
        if ((await resultsPanel.count()) > 0) {
          await resultsPanel.hover();
          for (let i = 0; i < 2; i++) {
            await page.mouse.wheel(0, 3000);
            await page.waitForTimeout(600);
          }
        }

        await page.waitForSelector(
          '//a[contains(@href, "https://www.google.com/maps/place")]'
        );
        const found = await page
          .locator('//a[contains(@href, "https://www.google.com/maps/place")]')
          .count();
        this.log("INFO", `Currently Found: ${found}`);

        if (found >= total) {
          this.log("INFO", `Reached target of ${total} results`);
          break;
        }

        if (found === previouslyCountedA) {
          stagnantCount++;
          this.log(
            "INFO",
            `No new results found (${stagnantCount}/${maxStagnantIterations})`
          );

          if (stagnantCount >= maxStagnantIterations) {
            this.log("INFO", "Arrived at all available results");
            break;
          }

          // Try different scrolling strategy when stagnant
          await page.mouse.wheel(0, 10000);
          await page.waitForTimeout(1500);
        } else {
          stagnantCount = 0; // Reset stagnant counter
        }

        previouslyCountedA = found;
      }

      const listings = await page
        .locator('//a[contains(@href, "https://www.google.com/maps/place")]')
        .all();
      const limitedListings = listings.slice(
        0,
        Math.min(total, listings.length)
      );
      const parentListings = [];

      for (const listing of limitedListings) {
        parentListings.push(listing.locator("xpath=.."));
      }

      this.log("INFO", `Total Found: ${parentListings.length}`);

      for (let idx = 0; idx < parentListings.length; idx++) {
        const listing = parentListings[idx];
        try {
          await listing.click();
          await page.waitForSelector(
            '//div[@class="TIHn2 "]//h1[@class="DUwDvf lfPIob"]',
            { timeout: 10000 }
          );
          await page.waitForTimeout(1500); // Give time for details to load

          // Extract place_id from URL
          const currentUrl = page.url();
          const placeId = this.extractPlaceIdFromUrl(currentUrl);

          const place = await this.extractPlace(page);
          place.place_id = placeId;

          if (place.name) {
            places.push(place);
            this.log(
              "INFO",
              `Extracted: ${place.name} (${places.length}/${parentListings.length})`
            );
            // Call callback if provided to stream company immediately
            if (onCompanyFound) {
              onCompanyFound(place);
            }
          } else {
            this.log(
              "WARNING",
              `No name found for listing ${idx + 1}, skipping.`
            );
          }
        } catch (e) {
          this.log("WARNING", `Failed to extract listing ${idx + 1}: ${e}`);
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return places;
  }

  // Helper method to scrape from multiple locations if needed
  async scrapeCompaniesMultiLocation(
    searchFor: string,
    total: number = 20,
    locations?: string[],
    onCompanyFound?: (company: Place) => void
  ): Promise<Place[]> {
    const allPlaces: Place[] = [];
    const seenPlaceIds = new Set<string>();

    const defaultLocations = [
      "40.7128,-74.0060", // New York City
      "34.0522,-118.2437", // Los Angeles
      "41.8781,-87.6298", // Chicago
      "29.7604,-95.3698", // Houston
      "37.7749,-122.4194", // San Francisco
    ];

    const locationsToUse = locations || defaultLocations;
    const perLocation = Math.ceil(total / locationsToUse.length);

    for (const location of locationsToUse) {
      if (allPlaces.length >= total) break;

      this.log("INFO", `Searching in location: ${location}`);
      const locationPlaces = await this.scrapeCompanies(
        searchFor,
        perLocation,
        location,
        onCompanyFound
      );

      // Add unique places only
      for (const place of locationPlaces) {
        if (!seenPlaceIds.has(place.place_id) && allPlaces.length < total) {
          seenPlaceIds.add(place.place_id);
          allPlaces.push(place);
        }
      }

      this.log("INFO", `Total unique places so far: ${allPlaces.length}`);
    }

    return allPlaces.slice(0, total);
  }
}

export { GoogleMapsScraper };
export type { Place };
