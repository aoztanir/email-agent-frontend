"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Save, X, Users, Mail, LogIn } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { COLORS } from "@/constants/COLORS";
import { createClient } from "@/utils/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";

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
  onLogin?: () => void;
  contactLists?: ContactList[];
  isLoggedIn?: boolean;
  className?: string;
}

export default function ContactSaveBanner({
  contacts,
  isVisible,
  onDismiss,
  onLogin,
  contactLists = [],
  isLoggedIn = false,
  className = "",
}: ContactSaveBannerProps) {
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const totalContacts = contacts.length;
  const totalEmails = contacts.reduce(
    (sum, contact) => sum + (contact.emails?.length || 0),
    0
  );

  const handleSave = async () => {
    if (!isLoggedIn) {
      onLogin?.();
      return;
    }

    if (!selectedListId) {
      toast.error("Please select a contact list");
      return;
    }

    setIsSaving(true);
    try {
      // Check if user is actually authenticated
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("User not authenticated:", authError);
        toast.error("Please log in to save contacts");
        onLogin?.();
        return;
      }

      console.log("Authenticated user:", user.id);
      console.log("Selected contact list:", selectedListId);

      const contactIds = contacts.map((contact) => contact.id);

      // Prepare data for bulk insert
      const contactListMembers = contactIds.map((contactId) => ({
        contact_list_id: selectedListId,
        contact_id: contactId,
      }));

      // Bulk upsert contact list members (using upsert to handle duplicates gracefully)
      const { data: insertedMembers, error: insertError } = await supabase
        .from("contact_list_member")
        .upsert(contactListMembers, {
          onConflict: "contact_list_id,contact_id", // Use the unique constraint
          ignoreDuplicates: true,
        })
        .select("id, contact_id, contact_list_id");

      if (insertError) {
        console.error("Error inserting contact list members:", insertError);
        throw new Error(
          `Failed to save contacts to list: ${insertError.message}`
        );
      }

      const savedCount = insertedMembers?.length || 0;

      // Get the contact list name for the response
      const { data: contactList } = await supabase
        .from("contact_list")
        .select("name")
        .eq("id", selectedListId)
        .single();

      const listName = contactList?.name || "contact list";
      toast.success(`Successfully saved ${savedCount} contacts to ${listName}`);
      
      // Invalidate React Query caches to refresh manage page
      queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      queryClient.invalidateQueries({ queryKey: ["list-contacts", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      
      onDismiss();
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast.error("Failed to save contacts");
    } finally {
      setIsSaving(false);
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
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-3xl px-4 ${className}`}
      >
        <Alert
          className={` ${COLORS.emerald.light_variant_with_border.class} w-full flex items-center justify-between w-full`}
        >
          <div className="flex items-center gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-primary" />
                <AlertTitle className="text-lg">
                  Ready to save your discovered contacts?
                </AlertTitle>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    {totalContacts} contacts
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    {totalEmails} emails
                  </Badge>
                </div>

                {isLoggedIn && contactLists.length > 0 && (
                  <Select
                    value={selectedListId}
                    onValueChange={setSelectedListId}
                  >
                    <SelectTrigger className="w-48 h-9">
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
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
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
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
