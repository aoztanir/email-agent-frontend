"use client";

import { useState, useRef, useEffect } from "react";
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
  "Software development agencies",
  "E-commerce companies in Seattle",
  "Pharmaceutical companies in New Jersey",
  "Aerospace companies in California",
  "Energy companies in Texas",
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
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = SEARCH_SUGGESTIONS.filter((suggestion) =>
        suggestion.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(SEARCH_SUGGESTIONS);
    }
    setSelectedIndex(-1);
  }, [searchQuery]);

  // Handle positioning to prevent overflow
  useEffect(() => {
    if (showSuggestions && containerRef.current && suggestionsRef.current) {
      const container = containerRef.current;
      const suggestions = suggestionsRef.current;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;

      // Calculate dropdown height (max 240px as defined in CSS)
      const maxHeight = Math.min(240, filteredSuggestions.length * 40 + 40); // 40px per item + header
      const offset = 8; // 8px offset from card

      if (spaceBelow >= maxHeight || spaceBelow >= spaceAbove) {
        // Show below
        suggestions.style.top = `calc(100% + ${offset}px)`;
        suggestions.style.bottom = "auto";
        suggestions.style.maxHeight = `${Math.min(
          maxHeight,
          spaceBelow - offset
        )}px`;
      } else {
        // Show above
        suggestions.style.top = "auto";
        suggestions.style.bottom = `calc(100% + ${offset}px)`;
        suggestions.style.maxHeight = `${Math.min(
          maxHeight,
          spaceAbove - offset
        )}px`;
      }
    }
  }, [showSuggestions, filteredSuggestions]);

  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride || searchQuery;
    if (!query?.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setShowSuggestions(false);
    await onSearch(query, companyCount[0]);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
    await handleSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === "Enter") {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          handleSuggestionClick(filteredSuggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 150);
  };

  return (
    <motion.div
      ref={containerRef}
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
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
              disabled={isSearching}
              autoComplete="off"
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
      {showSuggestions && filteredSuggestions.length > 0 && (
        <motion.div
          ref={suggestionsRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute  z-50 bg-popover border rounded-lg shadow-lg overflow-hidden"
          style={{
            maxHeight: "240px",
            marginTop: "0px",
            marginBottom: "0px",
            // Position will be set by useEffect
          }}
        >
          <div className="sticky top-0 bg-popover p-3 text-xs font-medium text-muted-foreground border-b border-border/50 z-10">
            {searchQuery.trim() ? "Matching suggestions" : "Popular searches"}
          </div>
          <div
            className="overflow-y-scroll p-2 space-y-1"
            style={{ maxHeight: "200px" }}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedIndex === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
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
