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
  searchCompaniesAndContacts: (query: string, amount: number) => Promise<void>;
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
  searchCompaniesAndContacts: async (query: string, amount: number) => {
    set({ 
      isSearching: true, 
      hasSearched: true, 
      searchQuery: query,
      currentStage: "companies",
      currentStatus: "Starting search...",
      companies: [],
      contacts: {},
      emailPatterns: []
    });

    try {
      // Step 1: Search companies
      set({ currentStatus: "Finding companies..." });
      
      const companiesResponse = await fetch('/api/search-companies-and-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, total: amount })
      });

      if (!companiesResponse.ok) {
        throw new Error('Failed to find companies');
      }

      const reader = companiesResponse.body?.getReader();
      if (!reader) throw new Error('No response body reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'company_found') {
                set((state) => ({
                  companies: [...state.companies, data.company]
                }));
              } else if (data.type === 'contact_found') {
                set((state) => ({
                  contacts: {
                    ...state.contacts,
                    [data.contact.company_id]: [
                      ...(state.contacts[data.contact.company_id] || []),
                      data.contact
                    ]
                  }
                }));
              } else if (data.type === 'email_patterns_generated') {
                set({ emailPatterns: data.data.patterns });
              } else if (data.type === 'status') {
                set({ currentStatus: data.message });
              } else if (data.type === 'stage') {
                set({ currentStage: data.stage });
              } else if (data.type === 'complete') {
                set({ 
                  isSearching: false, 
                  currentStatus: data.message 
                });
              } else if (data.type === 'error') {
                set({ 
                  isSearching: false, 
                  currentStatus: `Error: ${data.message}`,
                  currentStage: ""
                });
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }
      
      // Only set completion status if not already set by the 'complete' message
      set((state) => ({
        isSearching: false,
        currentStatus: state.currentStatus || "Search complete"
      }));
    } catch (error) {
      console.error('Search failed:', error);
      set({ 
        isSearching: false, 
        currentStatus: "Search failed",
        currentStage: ""
      });
    }
  },
}));
