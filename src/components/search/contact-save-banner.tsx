"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Save, X, ChevronDown, Users, Mail, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

interface ContactList {
  id: string;
  name: string;
  description?: string;
  contact_count?: number;
}

interface ContactSaveBannerProps {
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

export default function ContactSaveBanner({
  contacts,
  isVisible,
  onDismiss,
  onSave,
  onLogin,
  contactLists = [],
  isLoggedIn = false,
  isSaving = false,
  className = ""
}: ContactSaveBannerProps) {
  const [selectedListId, setSelectedListId] = useState<string>("");
  
  const totalContacts = contacts.length;
  const totalEmails = contacts.reduce((sum, contact) => sum + (contact.emails?.length || 0), 0);

  const handleSave = async () => {
    if (!isLoggedIn) {
      onLogin?.();
      return;
    }

    if (!selectedListId) {
      toast.error("Please select a contact list");
      return;
    }

    if (onSave) {
      await onSave(selectedListId);
    }
  };

  if (!isVisible || totalContacts === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4 ${className}`}
      >
        <Alert className="bg-background/95 backdrop-blur border shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <Save className="w-5 h-5 text-primary" />
              
              <div className="flex-1 space-y-2">
                <AlertDescription className="font-medium">
                  Ready to save your discovered contacts?
                </AlertDescription>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {totalContacts} contacts
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {totalEmails} emails
                    </Badge>
                  </div>
                  
                  {isLoggedIn && contactLists.length > 0 && (
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                      <SelectTrigger className="w-48 h-8">
                        <SelectValue placeholder="Select contact list" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{list.name}</span>
                              {list.contact_count !== undefined && (
                                <Badge variant="outline" className="ml-2">
                                  {list.contact_count}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || (isLoggedIn && !selectedListId)}
                className="flex items-center gap-2"
                size="sm"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isLoggedIn ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {isLoggedIn ? "Save Contacts" : "Login to Save"}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}