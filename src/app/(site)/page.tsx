"use client";

import { useRef } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { cn } from "@/lib/utils";
import WelcomeSection from "./components/WelcomeSection";
import SearchInput from "./components/SearchInput";
import SearchResults from "./components/SearchResults";
import CompanyDetailsModal from "./components/CompanyDetailsModal";
import { useSearchStore } from "@/store/searchStore";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { BackgroundBeams } from "@/components/magicui/background-beams";
import { DockDemo } from "@/components/dock";

export default function MainPage() {
  const hasSearched = useSearchStore((state) => state.hasSearched);
  const inputRef = useRef<HTMLDivElement>(null);

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white relative">
      {!hasSearched && (
        <BackgroundBeams />
        // <FlickeringGrid
        //   className="fixed inset-0 z-0 w-full h-full [mask-image:radial-gradient(900px_circle_at_center,white,transparent)]"
        //   squareSize={4}
        //   gridGap={6}
        //   color="#60A5FA"
        //   maxOpacity={0.5}
        //   flickerChance={0.1}
        //   height={2000}
        //   width={2000}
        // />
      )}


      {hasSearched && (
        <div className="relative z-10 pt-20 pb-32">
          <div className="w-full max-w-7xl mx-auto px-4">
            <SearchResults />
          </div>
        </div>
      )}

      <div
        ref={inputRef}
        className={`${
          hasSearched
            ? "fixed bottom-4 left-1/2 transform -translate-x-1/2"
            : "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        } w-full max-w-3xl px-4 z-20 transition-all duration-500 ease-in-out`}
      >
        <WelcomeSection hasSearched={hasSearched} />
        <SearchInput />
      </div>

      <CompanyDetailsModal />
      
      <DockDemo />
    </main>
  );
}
