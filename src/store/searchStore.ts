import { create } from "zustand";

interface Company {
  id: string;
  name: string;
  website: string;
  address?: string;
  phone_number?: string;
  is_existing?: boolean;
}

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

interface EmailPattern {
  companyId: string;
  companyName: string;
  domain: string;
  patterns: Array<{
    pattern: string;
    confidence: number;
    description: string;
  }>;
  commonFormat: string;
  reasoning: string;
}

interface SearchState {
  companies: Company[];
  contacts: Record<string, Contact[]>;
  emailPatterns: EmailPattern[];
  companiesWithUncertainPatterns: string[];
  isSearching: boolean;
  hasSearched: boolean;
  searchQuery: string;
  currentStatus: string;
  currentStage: string;
  selectedCompany: Company | null;
  isModalOpen: boolean;
  currentPromptId: string | null;

  // Actions
  addCompany: (company: Company) => void;
  addContact: (contact: Contact) => void;
  setCompanies: (
    companies: Company[] | ((prev: Company[]) => Company[])
  ) => void;
  setContacts: (
    contacts:
      | Record<string, Contact[]>
      | ((prev: Record<string, Contact[]>) => Record<string, Contact[]>)
  ) => void;
  setEmailPatterns: (patterns: EmailPattern[]) => void;
  setCompaniesWithUncertainPatterns: (companies: string[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  setHasSearched: (hasSearched: boolean) => void;
  setSearchQuery: (query: string) => void;
  setCurrentStatus: (status: string) => void;
  setCurrentStage: (stage: string) => void;
  setSelectedCompany: (company: Company | null) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  setCurrentPromptId: (promptId: string | null) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  companies: [],
  contacts: {},
  emailPatterns: [],
  companiesWithUncertainPatterns: [],
  isSearching: false,
  hasSearched: false,
  searchQuery: "",
  currentStatus: "",
  currentStage: "",
  selectedCompany: null,
  isModalOpen: false,
  currentPromptId: null,

  addCompany: (company) =>
    set((state) => ({
      companies: [...state.companies, company],
    })),
  addContact: (contact) =>
    set((state) => {
      const companyContacts = state.contacts[contact.company_id] || [];
      return {
        contacts: {
          ...state.contacts,
          [contact.company_id]: [...companyContacts, contact],
        },
      };
    }),
  setCompanies: (companies) =>
    set((state) => ({
      companies:
        typeof companies === "function"
          ? companies(state.companies)
          : companies,
    })),
  setContacts: (contacts) =>
    set((state) => ({
      contacts:
        typeof contacts === "function" ? contacts(state.contacts) : contacts,
    })),
  setEmailPatterns: (emailPatterns) => set({ emailPatterns }),
  setCompaniesWithUncertainPatterns: (companiesWithUncertainPatterns) => set({ companiesWithUncertainPatterns }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setHasSearched: (hasSearched) => set({ hasSearched }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCurrentStatus: (currentStatus) => set({ currentStatus }),
  setCurrentStage: (currentStage) => set({ currentStage }),
  setSelectedCompany: (selectedCompany) => set({ selectedCompany }),
  setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
  setCurrentPromptId: (currentPromptId) => set({ currentPromptId }),
  clearResults: () =>
    set({
      companies: [],
      contacts: {},
      emailPatterns: [],
      companiesWithUncertainPatterns: [],
      currentStatus: "",
      currentStage: "",
      selectedCompany: null,
      isModalOpen: false,
      currentPromptId: null,
    }),
}));
