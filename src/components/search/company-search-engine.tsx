"use client";

import { useState } from "react";
import { Company, Contact, ContactList } from "./types";
import { useSearch } from "@/hooks/use-search";
import SearchInput from "./search-input";
import SearchResults from "./search-results";
import CompanyContactsModal from "./company-contacts-modal";
import ContactSaveBanner from "./contact-save-banner";

interface CompanySearchEngineProps {
  showBorderBeam?: boolean;
  showProgressBanner?: boolean;
  showContactsInline?: boolean;
  showSaveOption?: boolean;
  isLoggedIn?: boolean;
  contactLists?: ContactList[];
  onSaveContacts?: (contacts: Contact[], contactListId: string) => Promise<void>;
  onLogin?: () => void;
  onSearchStart?: () => void;
  showSearchInput?: boolean;
  showResults?: boolean;
  className?: string;
}

export default function CompanySearchEngine({
  showBorderBeam = true,
  showProgressBanner = true,
  showContactsInline = false,
  showSaveOption = true,
  isLoggedIn = false,
  contactLists = [],
  onSaveContacts,
  onLogin,
  onSearchStart,
  showSearchInput = true,
  showResults = true,
  className = ""
}: CompanySearchEngineProps) {
  const {
    companies,
    contacts,
    isSearching,
    currentStage,
    currentStatus,
    searchQuery,
    searchCompaniesAndContacts
  } = useSearch();

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleViewCompanyContacts = (company: Company) => {
    setSelectedCompany(company);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
  };

  const handleSaveModalContacts = (contacts: Contact[]) => {
    setIsModalOpen(false);
    setShowSaveBanner(true);
  };

  const handleSaveContacts = async (contactListId: string) => {
    if (!onSaveContacts) return;

    setIsSaving(true);
    try {
      const allContacts = Object.values(contacts).flat();
      await onSaveContacts(allContacts, contactListId);
      setShowSaveBanner(false);
    } catch (error) {
      console.error("Error saving contacts:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async (query: string, amount: number) => {
    setShowSaveBanner(false);
    onSearchStart?.();
    await searchCompaniesAndContacts(query, amount);
    
    // Show save banner when search is complete and we have contacts
    if (!isSearching && Object.values(contacts).flat().length > 0) {
      setShowSaveBanner(true);
    }
  };

  const totalContacts = Object.values(contacts).flat();

  const hasResults = companies.length > 0 || isSearching;

  return (
    <div className={`${className}`}>
      {showSearchInput && (
        <div className={hasResults ? "mb-8" : ""}>
          <SearchInput
            onSearch={handleSearch}
            isSearching={isSearching}
            showBorderBeam={showBorderBeam}
          />
        </div>
      )}

      {showResults && hasResults && (
        <div className="space-y-6">
          <SearchResults
            companies={companies}
            contacts={contacts}
            isSearching={isSearching}
            currentStage={currentStage}
            currentStatus={currentStatus}
            searchQuery={searchQuery}
            onViewCompanyContacts={handleViewCompanyContacts}
            showProgressBanner={showProgressBanner}
            showContactsInline={showContactsInline}
          />
        </div>
      )}

      <CompanyContactsModal
        company={selectedCompany}
        contacts={selectedCompany ? contacts[selectedCompany.id] || [] : []}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSaveContacts={showSaveOption ? handleSaveModalContacts : undefined}
        showSaveOption={showSaveOption}
      />

      <ContactSaveBanner
        contacts={totalContacts}
        isVisible={showSaveBanner && showSaveOption}
        onDismiss={() => setShowSaveBanner(false)}
        onSave={handleSaveContacts}
        onLogin={onLogin}
        contactLists={contactLists}
        isLoggedIn={isLoggedIn}
        isSaving={isSaving}
      />
    </div>
  );
}