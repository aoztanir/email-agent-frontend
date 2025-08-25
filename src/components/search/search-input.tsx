"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Search, Send } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SearchInputProps {
  onSearch: (query: string, amount: number) => Promise<void>;
  isSearching?: boolean;
  initialQuery?: string;
  maxCompanies?: number;
  showBorderBeam?: boolean;
  className?: string;
  placeholder?: string;
}

const SEARCH_SUGGESTIONS = [
  "Investment banks in NYC",
  "Tech startups in San Francisco",
  "Law firms in Chicago",
  "Marketing agencies in Los Angeles",
  "Consulting firms in Boston",
  "Real estate companies in Miami",
  "Healthcare startups in Austin",
  "Fintech companies in London",
  "VC firms in Chicago",
  "Consulting firms for me to network with",
];

export default function SearchInput({
  onSearch,
  isSearching = false,
  initialQuery = "",
  maxCompanies = 10,
  showBorderBeam = true,
  className = "",
  placeholder = "Search for companies (e.g., investment banks in NYC)",
}: SearchInputProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [companyCount, setCompanyCount] = useState([5]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride || searchQuery;
    if (!query?.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    await onSearch(query, companyCount[0]);
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
      className={`relative ${className}`}
    >
      <div className="relative bg-card border border-1 rounded-xl p-3 shadow-xl space-y-1">
        {/* Search Input */}
        <div className="relative space-y-2">
          <div className="relative flex items-center">
            <Search className="text-muted-foreground w-4 h-4 mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder={placeholder}
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
              max={maxCompanies}
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
        {showBorderBeam && (
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            <BorderBeam
              duration={6}
              size={300}
              colorFrom="#f6733bff"
              colorTo="#fcb234ff"
            />
            <BorderBeam
              duration={8}
              delay={2}
              size={250}
              borderWidth={1}
              colorFrom="#f63b3bff"
              colorTo="#fc3434ff"
            />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
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
