"use client";

import { motion, AnimatePresence } from "motion/react";
import { Search, Building2, Users, Mail } from "lucide-react";
import CompanyCard from "./company-card";
import ProgressBanner from "./progress-banner";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  emails: Array<{
    email: string;
    status: string;
    is_deliverable?: boolean | null;
  }>;
  company_id: string;
  company_name: string;
  linkedin_url?: string;
  is_existing?: boolean;
}

interface Company {
  id: string;
  name: string;
  website: string;
  address?: string;
  phone_number?: string;
  introduction?: string;
  is_existing?: boolean;
}

interface SearchResultsProps {
  companies: Company[];
  contacts: Record<string, Contact[]>;
  isSearching: boolean;
  currentStage: string;
  currentStatus: string;
  searchQuery: string;
  onViewCompanyContacts?: (company: Company) => void;
  showProgressBanner?: boolean;
  showContactsInline?: boolean;
  className?: string;
}

export default function SearchResults({
  companies,
  contacts,
  isSearching,
  currentStage,
  currentStatus,
  searchQuery,
  onViewCompanyContacts,
  showProgressBanner = true,
  showContactsInline = false,
  className = ""
}: SearchResultsProps) {
  const totalContacts = Object.values(contacts).flat().length;
  const totalEmails = Object.values(contacts)
    .flat()
    .reduce((sum, contact) => sum + (contact.emails?.length || 0), 0);

  if (companies.length === 0 && !isSearching) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress Banner */}
      {showProgressBanner && (
        <ProgressBanner
          currentStage={currentStage}
          currentStatus={currentStatus}
          isSearching={isSearching}
        />
      )}

      {/* Search Results Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Search className="w-6 h-6 text-primary" />
              Search Results
            </h2>
            {searchQuery && (
              <p className="text-muted-foreground">
                Showing results for "{searchQuery}"
              </p>
            )}
          </div>

          {/* Statistics */}
          {(companies.length > 0 || totalContacts > 0 || totalEmails > 0) && (
            <div className="flex gap-2">
              {companies.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {companies.length} companies
                </Badge>
              )}
              {totalContacts > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {totalContacts} contacts
                </Badge>
              )}
              {totalEmails > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {totalEmails} emails
                </Badge>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Companies Grid */}
      {companies.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <AnimatePresence>
            {companies.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CompanyCard
                  company={company}
                  contacts={contacts[company.id] || []}
                  onViewContacts={onViewCompanyContacts}
                  showContactsInline={true}
                  index={index}
                  isSearching={isSearching}
                  currentStatus={currentStatus}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Loading State */}
      {isSearching && companies.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 space-y-4"
        >
          <div className="w-12 h-12 mx-auto border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Searching for companies...</h3>
            <p className="text-muted-foreground">
              This may take a few moments while we discover companies and contacts.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}