"use client";

import { motion } from "motion/react";
import SearchInput from "@/components/search/search-input";
import SearchResults from "@/components/search/search-results";
import CompanyContactsModal from "@/components/search/company-contacts-modal";
import { useSearchStore } from "@/store/searchStore";
import { BackgroundBeams } from "@/components/magicui/background-beams";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COLORS } from "@/constants/COLORS";

interface FeatureCardProps {
  title: string;
  description: string;
  colorClass: string;
}

function FeatureCard({ title, description, colorClass }: FeatureCardProps) {
  return (
    <Card className={`${colorClass} h-full`}>
      <CardHeader>
        <CardTitle className="text-left font-serif text-lg">{title}</CardTitle>
        <CardDescription className="text-left text-sm">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function FindContactsPage() {
  const { 
    hasSearched, 
    companies, 
    contacts, 
    isSearching, 
    currentStage, 
    currentStatus, 
    searchQuery,
    selectedCompany,
    setSelectedCompany,
    searchCompaniesAndContacts 
  } = useSearchStore();

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] relative">
      {/* Background beams for welcome state */}
      {!hasSearched && (
        <div className="absolute inset-0 pointer-events-none">
          <BackgroundBeams />
        </div>
      )}

      <div className="flex-1 flex flex-col relative z-10">
        {/* Search Results - appear above search input */}
        {hasSearched && (
          <div className="flex-1 pb-8">
            <SearchResults
              companies={companies}
              contacts={contacts}
              isSearching={isSearching}
              currentStage={currentStage}
              currentStatus={currentStatus}
              searchQuery={searchQuery}
              onViewCompanyContacts={(company) => setSelectedCompany(company)}
              showProgressBanner={true}
              showContactsInline={false}
            />
          </div>
        )}

        {/* Search Input - always at bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-3xl mx-auto">
            {!hasSearched && (
              <div className="mb-7">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-3xl mx-auto w-full"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-full mx-auto w-full"
                  >
                    <FeatureCard
                      title="AI Company Discovery"
                      description="Search any industry or location and let AI find real companies with addresses and descriptions."
                      colorClass={COLORS.red.light_variant_with_border.class}
                    />
                    <FeatureCard
                      title="Smart Email Patterns"
                      description="AI analyzes each company's email format and generates accurate contact addresses automatically."
                      colorClass={COLORS.amber.light_variant_with_border.class}
                    />
                    <FeatureCard
                      title="Contact Discovery"
                      description="Automatically finds key professionals at target companies and identifies decision makers."
                      colorClass={
                        COLORS.emerald.light_variant_with_border.class
                      }
                    />
                    <FeatureCard
                      title="Real-Time Streaming"
                      description="Watch results appear instantly as companies, contacts, and email addresses are discovered live."
                      colorClass={COLORS.blue.light_variant_with_border.class}
                    />
                  </motion.div>
                </motion.div>
              </div>
            )}
            <SearchInput
              onSearch={(query, amount) => searchCompaniesAndContacts(query, amount)}
              isSearching={isSearching}
              showBorderBeam={!hasSearched}
            />
          </div>
        </div>
      </div>

      <CompanyContactsModal 
        company={selectedCompany}
        contacts={selectedCompany ? contacts[selectedCompany.id] || [] : []}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onSaveContacts={() => {
          setSelectedCompany(null);
          // TODO: Implement save functionality
        }}
        showSaveOption={true}
      />
    </div>
  );
}
