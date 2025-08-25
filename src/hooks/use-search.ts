"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Company, Contact } from "@/components/search/types";

interface SearchState {
  companies: Company[];
  contacts: Record<string, Contact[]>;
  isSearching: boolean;
  currentStage: string;
  currentStatus: string;
  hasSearched: boolean;
  searchQuery: string;
}

interface SearchProgress {
  totalCompanies: number;
  companiesProcessed: number;
  currentCompany?: string;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    companies: [],
    contacts: {},
    isSearching: false,
    currentStage: "",
    currentStatus: "",
    hasSearched: false,
    searchQuery: ""
  });

  const [progress, setProgress] = useState<SearchProgress>({
    totalCompanies: 0,
    companiesProcessed: 0
  });

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      companies: [],
      contacts: {},
      currentStage: "",
      currentStatus: ""
    }));
    setProgress({
      totalCompanies: 0,
      companiesProcessed: 0
    });
  }, []);

  const addCompany = useCallback((company: Company) => {
    setState(prev => ({
      ...prev,
      companies: [...prev.companies, company]
    }));
  }, []);

  const addContact = useCallback((contact: Contact) => {
    setState(prev => ({
      ...prev,
      contacts: {
        ...prev.contacts,
        [contact.company_id]: [
          ...(prev.contacts[contact.company_id] || []),
          contact
        ]
      }
    }));
  }, []);

  const updateProgress = useCallback((newProgress: Partial<SearchProgress>) => {
    setProgress(prev => ({ ...prev, ...newProgress }));
  }, []);

  const searchCompaniesAndContacts = useCallback(async (query: string, amount: number) => {
    setState(prev => ({
      ...prev,
      isSearching: true,
      hasSearched: true,
      searchQuery: query,
      currentStage: "companies",
      currentStatus: "Starting search..."
    }));
    
    clearResults();

    // Show progress toast
    const searchToastId = toast.loading("Finding companies...", {
      duration: Infinity,
    });

    try {
      // Step 1: Find companies  
      setState(prev => ({
        ...prev,
        currentStatus: "Finding companies...",
        currentStage: "companies"
      }));

      const companiesResponse = await fetch("/api/find/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, amount })
      });

      if (!companiesResponse.ok) {
        throw new Error("Failed to find companies");
      }

      const companiesData = await companiesResponse.json();
      const companies: Company[] = companiesData.companies || [];

      setState(prev => ({
        ...prev,
        companies,
        currentStatus: `Found ${companies.length} companies`
      }));

      // Update toast
      toast.loading("Finding emails...", {
        id: searchToastId,
        duration: Infinity,
      });

      updateProgress({
        totalCompanies: companies.length,
        companiesProcessed: 0
      });

      if (companies.length === 0) {
        setState(prev => ({
          ...prev,
          currentStage: "complete",
          currentStatus: "No companies found for your query",
          isSearching: false
        }));
        toast.error("No companies found for your query", { id: searchToastId });
        return;
      }

      // Step 2: Find email patterns
      setState(prev => ({
        ...prev,
        currentStage: "email_patterns",
        currentStatus: "Finding emails..."
      }));

      const companyIds = companies.map(c => c.id);
      const emailPatternsResponse = await fetch("/api/find/email-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds })
      });

      if (!emailPatternsResponse.ok) {
        console.warn("Failed to generate email patterns, continuing without them");
      }

      setState(prev => ({
        ...prev,
        currentStatus: "Email patterns generated, finding contacts..."
      }));

      // Step 3: Find contacts for each company
      setState(prev => ({
        ...prev,
        currentStage: "contacts",
        currentStatus: "Finding contacts..."
      }));

      let totalContactsFound = 0;
      let totalEmailsGenerated = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        
        const companyStatus = `Finding contacts (${i + 1}/${companies.length})`;
        setState(prev => ({
          ...prev,
          currentStatus: companyStatus
        }));

        // Update toast with current company (truncated)
        const displayName = company.name.length > 20 ? company.name.substring(0, 20) + "..." : company.name;
        toast.loading(`${companyStatus}: ${displayName}`, {
          id: searchToastId,
          duration: Infinity,
        });
        
        updateProgress({
          companiesProcessed: i,
          currentCompany: company.name
        });

        try {
          const contactsResponse = await fetch("/api/find/people-at-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId: company.id,
              alreadyFoundContacts: []
            })
          });

          if (contactsResponse.ok) {
            const contactsData = await contactsResponse.json();
            const rawContacts = contactsData.contacts || [];
            
            // Map the data structure from API format to frontend format
            // API now handles deduplication, so we can directly map
            const contacts: Contact[] = rawContacts.map((contact: any) => ({
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              linkedin_url: contact.linkedin_url,
              company_id: company.id,
              company_name: company.name,
              is_existing: contact.is_existing,
              // Map contact_email array to emails array
              emails: (contact.contact_email || []).map((emailObj: any) => ({
                email: emailObj.email,
                status: "found", // Default status
                is_deliverable: null
              }))
            }));
            
            if (contacts.length > 0) {
              setState(prev => ({
                ...prev,
                contacts: {
                  ...prev.contacts,
                  [company.id]: contacts
                }
              }));

              totalContactsFound += contacts.length;
              totalEmailsGenerated += contacts.reduce((sum, c) => sum + (c.emails?.length || 0), 0);
            }
          }
        } catch (error) {
          console.error(`Error finding contacts for ${company.name}:`, error);
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      updateProgress({ companiesProcessed: companies.length });

      // Complete
      setState(prev => ({
        ...prev,
        currentStage: "complete",
        currentStatus: "Search completed!",
        isSearching: false
      }));

      const message = `Found ${companies.length} companies, ${totalContactsFound} contacts, and ${totalEmailsGenerated} emails!`;
      toast.success(message, { id: searchToastId });

    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.", { id: searchToastId });
      
      setState(prev => ({
        ...prev,
        isSearching: false,
        currentStatus: "Search failed",
        currentStage: "error"
      }));
    }
  }, [clearResults, addCompany, addContact, updateProgress]);

  return {
    ...state,
    progress,
    searchCompaniesAndContacts,
    clearResults,
    addCompany,
    addContact
  };
}