"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Search, Send } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSearchStore } from "@/store/searchStore";

const SEARCH_SUGGESTIONS = [
  "Investment banks in NYC",
  "Tech startups in San Francisco",
  "Law firms in Chicago",
  "Marketing agencies in Los Angeles",
  "Consulting firms in Boston",
  "Real estate companies in Miami",
  "Healthcare startups in Austin",
  "Fintech companies in London",
];

export default function SearchInput() {
  const [companyCount, setCompanyCount] = useState([5]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    searchQuery,
    isSearching,
    setSearchQuery,
    setIsSearching,
    setHasSearched,
    setCompanies,
    setCurrentStatus,
    setCurrentStage,
    setEmailPatterns,
    setCompaniesWithUncertainPatterns,
    clearResults,
  } = useSearchStore();

  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride || searchQuery;
    if (!query?.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    clearResults();

    try {
      // Call our Next.js API endpoint
      const response = await fetch("/api/search-companies-and-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          total: companyCount[0],
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += new TextDecoder().decode(value);
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case "status":
                    setCurrentStatus(data.message);
                    setCurrentStage(data.stage);
                    break;

                  case "company_found":
                    // Add individual company to the store
                    const { addCompany } = useSearchStore.getState();
                    addCompany(data.company);
                    break;

                  case "contact_found":
                    // Add individual contact to the store using the new addContact method
                    const contact = data.contact;
                    console.log("Contact found:", contact);
                    const { addContact } = useSearchStore.getState();
                    addContact(contact);
                    break;

                  case "email_patterns_generated":
                    // Store the generated email patterns
                    console.log("Email patterns generated:", data.data);
                    setEmailPatterns(data.data.patterns);
                    setCurrentStatus(
                      `Generated ${data.data.patternsCount} email patterns`
                    );
                    break;

                  case "uncertain_patterns":
                    // Handle companies with uncertain email patterns
                    console.log(
                      "Companies with uncertain patterns:",
                      data.companies
                    );
                    setCompaniesWithUncertainPatterns(data.companies);
                    toast.info(data.message);
                    break;

                  case "companies_found":
                    setCompanies(data.companies);
                    // toast.success(data.message);
                    break;

                  // case "relationships_created":
                  //   setCurrentStatus(data.message);
                  //   break;

                  case "warning":
                    console.warn("API Warning:", data.message);
                    toast.warning(data.message);
                    break;

                  case "complete":
                    setCurrentStatus("Search completed!");
                    setCurrentStage("complete");
                    if (data.data) {
                      const {
                        companiesFound,
                        contactsFound,
                        emailsGenerated,
                        companiesWithUnsurePatterns,
                      } = data.data;
                      let message = `Successfully found ${companiesFound} companies, ${
                        contactsFound || 0
                      } contacts, and ${emailsGenerated || 0} emails!`;

                      if (companiesWithUnsurePatterns > 0) {
                        message += ` (${companiesWithUnsurePatterns} companies skipped due to uncertain email patterns)`;
                      }

                      toast.success(message);
                      // Fetch the stored companies from the database
                      // fetchStoredCompanies(data.data.promptId);
                    } else {
                      toast.success("Company search completed!");
                    }
                    break;

                  case "error":
                    console.error("Stream error:", data.message);
                    toast.error(data.message || "An error occurred");
                    break;
                }
              } catch (e) {
                console.error("Error parsing stream data:", e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    await handleSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      handleSearch();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <div className="relative bg-card border border-1 rounded-xl p-3  shadow-xl space-y-1">
        {/* Search Input */}
        <div className="relative space-y-2">
          <div className="relative flex items-center">
            <Search className="text-muted-foreground w-4 h-4 mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search for companies (e.g., investment banks in NYC)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
              disabled={isSearching}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="ml-2 h-8 w-8 p-0 flex-shrink-0"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Suggestions Dropdown */}
        </div>

        {/* Company Count Slider */}
        <div className="flex items-center gap-2 pb-0 mb-0 pt-1">
          <span className="text-xs text-muted-foreground min-w-fit">
            Maximum
          </span>
          <div className="flex-1">
            <Slider
              value={companyCount}
              onValueChange={setCompanyCount}
              max={10}
              min={1}
              step={1}
              className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
              disabled={isSearching}
            />
          </div>
          <span className="text-xs font-medium min-w-[2rem] text-center bg-accent text-accent-foreground px-2 py-1 rounded">
            {companyCount[0]}
          </span>
        </div>

        {/* Border effects */}
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <BorderBeam
            duration={6}
            size={300}
            colorFrom="#3b82f6"
            colorTo="#8b5cf6"
          />
          <BorderBeam
            duration={8}
            delay={2}
            size={250}
            borderWidth={1}
            colorFrom="#10b981"
            colorTo="#f59e0b"
          />
        </div>
      </div>
      {showSuggestions && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 z-50 bg-popover border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto"
        >
          <div className="p-2 space-y-1">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Popular searches
            </div>
            {SEARCH_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
