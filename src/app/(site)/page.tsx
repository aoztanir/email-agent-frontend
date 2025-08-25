"use client";

import { useState } from "react";
import { BackgroundBeams } from "@/components/magicui/background-beams";
import { DockDemo } from "@/components/site/dock";

import SearchInput from "@/components/search/search-input";
import SearchResults from "@/components/search/search-results";
import CompanyContactsModal from "@/components/search/company-contacts-modal";
import ContactSaveBanner from "@/components/search/contact-save-banner";
import { useSearch } from "@/hooks/use-search";
import { toast } from "sonner";
import WelcomeSection from "@/components/site/WelcomeSection";

export default function MainPage() {
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    companies,
    contacts,
    isSearching,
    currentStage,
    currentStatus,
    searchQuery,
    searchCompaniesAndContacts,
  } = useSearch();

  const handleLogin = () => {
    toast.info(
      "Login feature coming soon! For now, you can still search and discover contacts."
    );
    // TODO: Implement login functionality
  };

  const handleViewCompanyContacts = (company: any) => {
    setSelectedCompany(company);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
  };

  const handleSaveModalContacts = (contacts: any[]) => {
    setIsModalOpen(false);
    setShowSaveBanner(true);
  };

  const handleSaveContacts = async (contactListId: string) => {
    setIsSaving(true);
    try {
      const allContacts = Object.values(contacts).flat();
      // This is for demo purposes - in the real app this would save to the database
      toast.success(
        `Demo: Would save ${allContacts.length} contacts to list ${contactListId}`
      );
      setShowSaveBanner(false);
      // TODO: Implement actual save functionality when user system is ready
    } catch (error) {
      console.error("Error saving contacts:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async (query: string, amount: number) => {
    setShowSaveBanner(false);
    setHasSearched(true);
    await searchCompaniesAndContacts(query, amount);

    // Show save banner when search is complete and we have contacts
    if (!isSearching && Object.values(contacts).flat().length > 0) {
      setShowSaveBanner(true);
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white relative">
      {!hasSearched && <BackgroundBeams />}

      {/* Search Results Area */}
      {hasSearched && (
        <div className="relative z-10 pt-20 pb-32">
          <div className="w-full max-w-7xl mx-auto px-4">
            <SearchResults
              companies={companies}
              contacts={contacts}
              isSearching={isSearching}
              currentStage={currentStage}
              currentStatus={currentStatus}
              searchQuery={searchQuery}
              onViewCompanyContacts={handleViewCompanyContacts}
              showProgressBanner={false}
              showContactsInline={false}
            />
          </div>
        </div>
      )}

      {/* Centered Welcome + Search Input */}
      <div
        className={`${
          hasSearched
            ? "fixed bottom-4 left-1/2 transform -translate-x-1/2"
            : "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        } w-full max-w-3xl px-4 z-20 transition-all duration-500 ease-in-out`}
      >
        <WelcomeSection hasSearched={hasSearched} />
        <SearchInput
          onSearch={handleSearch}
          isSearching={isSearching}
          showBorderBeam={!hasSearched}
        />
      </div>

      {/* Modals and Banners */}
      <CompanyContactsModal
        company={selectedCompany}
        contacts={selectedCompany ? contacts[selectedCompany.id] || [] : []}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSaveContacts={handleSaveModalContacts}
        showSaveOption={true}
      />

      <ContactSaveBanner
        contacts={Object.values(contacts).flat()}
        isVisible={showSaveBanner}
        onDismiss={() => setShowSaveBanner(false)}
        onSave={handleSaveContacts}
        onLogin={handleLogin}
        contactLists={[]}
        isLoggedIn={false}
        isSaving={isSaving}
      />

      <DockDemo />
    </main>
  );
}
