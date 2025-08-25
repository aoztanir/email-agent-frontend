// Shared interfaces for search components

export interface Contact {
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

export interface Company {
  id: string;
  name: string;
  website: string;
  address?: string;
  phone_number?: string;
  introduction?: string;
  is_existing?: boolean;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  contact_count?: number;
}

export interface SearchInputProps {
  onSearch: (query: string, amount: number) => Promise<void>;
  isSearching?: boolean;
  initialQuery?: string;
  maxCompanies?: number;
  showBorderBeam?: boolean;
  className?: string;
  placeholder?: string;
}

export interface ProgressBannerProps {
  currentStage: string;
  currentStatus: string;
  isSearching: boolean;
  className?: string;
}

export interface CompanyCardProps {
  company: Company;
  contacts?: Contact[];
  onViewContacts?: (company: Company) => void;
  showContactsInline?: boolean;
  className?: string;
}

export interface SearchResultsProps {
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

export interface CompanyContactsModalProps {
  company: Company | null;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onSaveContacts?: (contacts: Contact[]) => void;
  showSaveOption?: boolean;
}

export interface ContactSaveBannerProps {
  contacts: Contact[];
  isVisible: boolean;
  onDismiss: () => void;
  onSave?: (contactListId: string) => Promise<void>;
  onLogin?: () => void;
  contactLists?: ContactList[];
  isLoggedIn?: boolean;
  isSaving?: boolean;
  className?: string;
}