"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building,
  Users,
  Mail,
  Loader2,
  ExternalLink,
  AlertTriangle,
  LogIn,
  Check,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/store/searchStore";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { COLORS } from "@/constants/COLORS";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOADING_MESSAGES = [
  "Scouring the digital landscape",
  "Hunting down company intel",
  "Unleashing the search algorithms",
  "Diving deep into business directories",
  "Connecting the professional dots",
  "Mapping the corporate universe",
  "Extracting valuable connections",
  "Decoding company networks",
  "Discovering hidden gems",
  "Assembling your business leads",
  "Scanning professional profiles",
  "Building your contact empire",
  "Weaving through corporate webs",
  "Harvesting business intelligence",
  "Crafting your lead pipeline",
];

const CONTACT_LOADING_MESSAGES = [
  "Searching LinkedIn profiles",
  "Finding key decision makers",
  "Extracting contact information",
  "Discovering team members",
  "Building professional networks",
  "Mapping organizational charts",
  "Identifying potential leads",
  "Gathering contact intelligence",
];

export default function SearchResults() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const {
    companies,
    contacts,
    companiesWithUncertainPatterns,
    isSearching,
    currentStatus,
    currentPromptId,
    setSelectedCompany,
    setIsModalOpen,
  } = useSearchStore();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Fetch contact lists
  const { data: contactLists = [], isLoading: isLoadingLists } = useQuery({
    queryKey: ["contact-lists", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("contact_list")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setIsLoadingAuth(false);
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Rotate loading messages every 2 seconds if no specific status
  useEffect(() => {
    if (isSearching && !currentStatus) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isSearching, currentStatus]);

  const getConfirmedEmailsCount = (companyId: string): number => {
    if (!contacts) return 0;
    const companyContacts = contacts[companyId] || [];
    return companyContacts.reduce(
      (count, contact) =>
        count +
        contact.emails.filter(
          (email) => email.is_deliverable === true
        ).length,
      0
    );
  };

  const totalContacts = Object.values(contacts || {}).flat().length;
  const totalEmails = Object.values(contacts || {})
    .flat()
    .reduce((sum, contact) => sum + contact.emails.length, 0);

  const handleSaveContacts = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedListId) {
      toast.error("Please select a contact list to save to");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();

      // Get all contacts with emails
      const allContacts = Object.values(contacts || {})
        .flat()
        .filter((contact) => contact.emails && contact.emails.length > 0);

      if (allContacts.length === 0) {
        toast.error("No contacts with emails to save");
        return;
      }

      console.log('Debug: About to save contacts:', allContacts.length);
      console.log('Debug: Sample contact:', allContacts[0]);

      let savedContactsCount = 0;
      let savedEmailsCount = 0;
      let addedToListCount = 0;

      // First, ensure companies are saved in user_company relationships
      const companyIds = [
        ...new Set(allContacts.map((contact) => contact.company_id)),
      ];
      for (const companyId of companyIds) {
        const { error: companyError } = await supabase
          .from("user_company")
          .upsert(
            {
              user_id: user.id,
              company_id: companyId,
              source_prompt_id: currentPromptId || null,
            },
            {
              onConflict: "user_id,company_id",
            }
          );

        if (companyError) {
          console.error("Error saving company relationship:", companyError);
        }
      }

      // Process each contact
      for (const contactData of allContacts) {
        try {
          console.log('Debug: Processing contact:', contactData.first_name, contactData.last_name);
          // Check if contact already exists
          const { data: existingContact } = await supabase
            .from("contact")
            .select("id")
            .eq("first_name", contactData.first_name)
            .eq("last_name", contactData.last_name || "")
            .eq("company_id", contactData.company_id)
            .maybeSingle();

          let contactId: string;

          if (existingContact) {
            // Use existing contact
            contactId = existingContact.id;
            console.log('Debug: Using existing contact:', contactId);
          } else {
            // Create new contact (normalized - no user_id)
            const { data: newContact, error: contactError } = await supabase
              .from("contact")
              .insert({
                first_name: contactData.first_name,
                last_name: contactData.last_name,
                linkedin_url: contactData.linkedin_url,
                company_id: contactData.company_id,
              })
              .select("id")
              .single();

            if (contactError || !newContact) {
              console.error("Error creating contact:", contactError);
              continue;
            }

            contactId = newContact.id;
            savedContactsCount++;
            console.log('Debug: Created new contact:', contactId);
          }

          // Create user-contact relationship
          const { error: userContactError } = await supabase
            .from("user_contact")
            .upsert(
              {
                user_id: user.id,
                contact_id: contactId,
                source_company_id: contactData.company_id,
              },
              {
                onConflict: "user_id,contact_id",
              }
            );

          if (userContactError) {
            console.error(
              "Error creating user-contact relationship:",
              userContactError
            );
          }

          // Save emails for this contact
          console.log('Debug: Contact emails:', contactData.emails);
          for (const emailData of contactData.emails) {
            console.log('Debug: Processing email:', emailData);
            // Check if email already exists for this contact
            const { data: existingEmail } = await supabase
              .from("contact_email")
              .select("id")
              .eq("contact_id", contactId)
              .eq("email", emailData.email)
              .maybeSingle();

            if (!existingEmail) {
              const { error: emailError } = await supabase
                .from("contact_email")
                .insert({
                  contact_id: contactId,
                  email: emailData.email,
                });

              if (!emailError) {
                savedEmailsCount++;
              } else {
                console.error("Error saving email:", emailError);
              }
            }
          }

          // Add contact to selected list
          if (selectedListId !== "base") {
            const { error: listMemberError } = await supabase
              .from("contact_list_member")
              .upsert(
                {
                  contact_list_id: selectedListId,
                  contact_id: contactId,
                },
                {
                  onConflict: "contact_list_id,contact_id",
                }
              );

            if (!listMemberError) {
              addedToListCount++;
            } else {
              console.error("Error adding contact to list:", listMemberError);
            }
          }
        } catch (contactError) {
          console.error(
            `Error processing contact ${contactData.first_name} ${contactData.last_name}:`,
            contactError
          );
        }
      }

      const selectedList = contactLists.find(list => list.id === selectedListId);
      const listName = selectedList ? selectedList.name : "your contacts";
      
      console.log('Debug: Final counts - contacts:', savedContactsCount, 'emails:', savedEmailsCount, 'addedToList:', addedToListCount);
      
      if (savedContactsCount > 0 || addedToListCount > 0) {
        toast.success(
          `Successfully saved ${savedContactsCount} new contacts and ${savedEmailsCount} new emails${selectedListId !== "base" ? ` to "${listName}"` : ""}!`
        );
      } else {
        toast.info(
          `All contacts were already in your database${selectedListId !== "base" ? ` and added to "${listName}"` : ""}!`
        );
      }
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast.error("Failed to save contacts. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Debug logging
  // console.log("SearchResults - contacts:", contacts);
  // console.log("SearchResults - totalContacts:", totalContacts);

  // Show loading screen only if no companies found yet
  if (isSearching && companies.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin mr-3" />
          <h2 className="text-2xl font-bold">
            {currentStatus?.includes("contact")
              ? "Finding Contacts..."
              : "Searching Companies..."}
          </h2>
        </div>
        <motion.p
          key={currentStatus || loadingMessageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-muted-foreground"
        >
          {currentStatus && !currentStatus.includes("...")
            ? currentStatus
            : currentStatus?.includes("contact") ||
              currentStatus?.includes("LinkedIn")
            ? CONTACT_LOADING_MESSAGES[
                loadingMessageIndex % CONTACT_LOADING_MESSAGES.length
              ]
            : LOADING_MESSAGES[loadingMessageIndex]}
        </motion.p>

        {/* Show progress stats if we have some data */}
        {(totalContacts > 0 || totalEmails > 0) && (
          <div className="flex justify-center gap-4 mt-6">
            <Badge variant="light" color="orange" className="text-sm">
              <Users className="w-4 h-4 mr-1" />
              {totalContacts} contacts
            </Badge>
            <Badge variant="light" color="emerald" className="text-sm">
              <Mail className="w-4 h-4 mr-1" />
              {totalEmails} emails
            </Badge>
          </div>
        )}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Search Results</h2>
        <p className="text-muted-foreground">
          Your search results will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isSearching && totalContacts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center  w-full"
        >
          {!isLoadingAuth && user ? (
            <Card
              className={
                COLORS.blue.light_variant_with_border.class + " w-full"
              }
            >
              <CardHeader className="flex items-center gap-4">
                <div>
                  <CardTitle>Save {totalContacts} contacts</CardTitle>
                  <CardDescription>
                    Select which list to save your contacts to for future use.
                  </CardDescription>
                </div>
                <div className="ml-auto flex gap-2 items-center">
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger className="bg-muted min-w-[200px]">
                      <SelectValue placeholder="Choose a list" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingLists ? (
                        <SelectItem value="loading" disabled>
                          Loading lists...
                        </SelectItem>
                      ) : (
                        <>
                          {contactLists.length === 0 && (
                            <SelectItem value="no-lists" disabled>
                              No lists available
                            </SelectItem>
                          )}
                          {contactLists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleSaveContacts}
                    disabled={isSaving || !selectedListId || totalContacts === 0}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save
                        <Check className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : // <Button
          //   onClick={handleSaveContacts}
          //   disabled={isSaving}
          //   size="lg"
          //   className="px-8"
          // >
          //   {isSaving ? (
          //     <>
          //       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          //       Saving...
          //     </>
          //   ) : (
          //     <>
          //       <Save className="w-4 h-4 mr-2" />
          //       Save {totalContacts} Contacts to My Lists
          //     </>
          //   )}
          // </Button>
          !isLoadingAuth ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Login to save contacts to your lists and send emails
              </p>
              <Button
                onClick={() => router.push("/login")}
                size="lg"
                variant="outline"
                className="px-8"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login to Save Contacts
              </Button>
            </div>
          ) : null}
        </motion.div>
      )}
      {/* Progress indicator when still searching */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 border rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {currentStatus || "Searching for more companies..."}
              </span>
            </div>

            {/* Show live stats */}
            <div className="flex gap-3 text-xs">
              <Badge variant="outline" className="text-xs">
                <Building className="w-3 h-3 mr-1" />
                {companies.length} companies
              </Badge>
              {totalContacts > 0 && (
                <Badge variant="light" color="emerald" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {totalContacts} contacts
                </Badge>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Companies Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* <h2 className="text-xl font-semibold">Found Companies</h2> */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((company, index) => {
            const companyContacts = contacts ? contacts[company.id] || [] : [];
            const confirmedEmails = getConfirmedEmailsCount(company.id);
            const hasUncertainPattern = companiesWithUncertainPatterns.includes(
              company.name
            );

            return (
              <Card
                key={company.id}
                className="p-4 cursor-pointer shadow-xl"
                onClick={() => {
                  setSelectedCompany(company);
                  setIsModalOpen(true);
                }}
              >
                <div className="space-y-3">
                  {/* Company Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1 flex gap-2 items-start min-w-0">
                      <p className="text-7xl font-serif">{index + 1}</p>
                      <div className="truncate">
                        <h3 className="font-semibold truncate  text-2xl font-serif">
                          {company.name}
                        </h3>
                        <a
                          className="text-sm text-muted-foreground truncate"
                          href={"http://" + company.website}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.website}
                        </a>
                        {company.address && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {company.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {hasUncertainPattern && (
                        <Badge
                          variant="outline"
                          className="text-yellow-600 border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                          title="AI was uncertain about email patterns for this company"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Emails Uncertain
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-2">
                    <Badge variant="light" color="blue" className="text-xs">
                      <Users className="w-3 h-3" />
                      {companyContacts.length} contacts
                    </Badge>
                    <Badge variant="light" color="orange" className="text-xs">
                      <Mail className="w-3 h-3" />
                      {confirmedEmails} emails
                    </Badge>
                    {isSearching && currentStatus?.includes(company.name) && (
                      <Badge
                        variant="outline"
                        className="text-xs animate-pulse"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Searching...
                      </Badge>
                    )}
                  </div>

                  {/* Quick preview of contacts */}
                  {companyContacts.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-muted-foreground">
                        Recent contacts:
                      </h4>
                      <div className="space-y-1">
                        {companyContacts.slice(0, 2).map((contact) => (
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
                                  className="text-blue-500 hover:text-blue-700"
                                  title={`View ${contact.first_name} ${contact.last_name}'s LinkedIn profile`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {contact.emails.slice(0, 1).map((email, idx) => (
                                <Badge
                                  key={idx}
                                  variant="light"
                                  color="emerald"
                                  className="text-[10px] px-1 py-0"
                                >
                                  {email.email}
                                </Badge>
                              ))}
                              {contact.emails.length === 0 && (
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
                        {companyContacts.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{companyContacts.length - 2} more...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Save Contacts Button */}
      </motion.div>
    </div>
  );
}
