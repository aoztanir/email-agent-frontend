"use client";
import { motion } from "motion/react";
import { Users, Mail, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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

interface CompanyCardProps {
  company: Company;
  contacts?: Contact[];
  onViewContacts?: (company: Company) => void;
  showContactsInline?: boolean;
  className?: string;
  index?: number;
  isSearching?: boolean;
  currentStatus?: string;
}

export default function CompanyCard({
  company,
  contacts = [],
  onViewContacts,
  showContactsInline = true,
  className = "",
  index = 0,
  isSearching = false,
  currentStatus = ""
}: CompanyCardProps) {
  const confirmedEmails = contacts.reduce(
    (count, contact) =>
      count +
      (contact.emails?.filter(
        (email) => email.is_deliverable === true
      )?.length || 0),
    0
  );

  const getWebsiteUrl = (website: string) => {
    if (!website) return "";
    return website.startsWith("http") ? website : `http://${website}`;
  };

  return (
    <Card
      className={`p-4 cursor-pointer shadow-xl hover:shadow-2xl transition-shadow ${className}`}
      onClick={() => onViewContacts?.(company)}
    >
      <div className="space-y-3">
        {/* Company Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1 flex gap-2 items-start min-w-0">
            <p className="text-7xl font-serif">{index + 1}</p>
            <div className="truncate">
              <h3 className="font-semibold truncate text-2xl font-serif">
                {company.name}
              </h3>
              {company.website && (
                <a
                  className="text-sm text-muted-foreground truncate hover:text-primary"
                  href={getWebsiteUrl(company.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {company.website}
                </a>
              )}
              {company.address && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {company.address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3" />
            {contacts.length} contacts
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Mail className="w-3 h-3" />
            {confirmedEmails} emails
          </Badge>
          {isSearching && currentStatus?.includes(company.name) && (
            <Badge variant="outline" className="text-xs animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Searching...
            </Badge>
          )}
        </div>

        {/* Quick preview of contacts */}
        {showContactsInline && contacts.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">
              Recent contacts:
            </h4>
            <div className="space-y-1">
              {contacts.slice(0, 2).map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">
                      {contact.first_name} {contact.last_name}
                    </span>
                    {contact.linkedin_url && (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80"
                        title={`View ${contact.first_name} ${contact.last_name}'s LinkedIn profile`}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {contact.emails && contact.emails.length > 0 ? (
                      contact.emails.slice(0, 1).map((email, idx) => (
                        <Badge
                          key={idx}
                          variant="light"
                          color="emerald"
                          className="text-[10px] px-1 py-0"
                        >
                          {email.email}
                        </Badge>
                      ))
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0"
                      >
                        LinkedIn
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
              {contacts.length > 2 && (
                <p className="text-xs text-muted-foreground">
                  +{contacts.length - 2} more...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}