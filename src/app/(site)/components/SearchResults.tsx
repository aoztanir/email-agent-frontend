"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Building,
  Users,
  Mail,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Save,
  LogIn,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
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

  const {
    companies,
    contacts,
    companiesWithUncertainPatterns,
    isSearching,
    currentStatus,
    currentStage,
    setSelectedCompany,
    setIsModalOpen,
  } = useSearchStore();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
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
          (email) =>
            email.is_deliverable === true ||
            email.confidence === "pattern_generated"
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

    setIsSaving(true);
    try {
      // Get all contacts with emails
      const allContacts = Object.values(contacts || {})
        .flat()
        .filter((contact) => contact.emails && contact.emails.length > 0);

      if (allContacts.length === 0) {
        alert("No contacts with emails to save");
        return;
      }

      const response = await fetch("/api/save-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: allContacts.map((contact) => ({
            first_name: contact.first_name,
            last_name: contact.last_name,
            linkedin_url: contact.linkedin_url,
            bio: contact.bio,
            scraped_company_id: contact.scraped_company_id,
            emails: contact.emails.map((e) => e.email),
          })),
        }),
      });

      if (response.ok) {
        alert("Contacts saved successfully to your list!");
      } else {
        throw new Error("Failed to save contacts");
      }
    } catch (error) {
      console.error("Error saving contacts:", error);
      alert("Failed to save contacts. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Debug logging
  console.log("SearchResults - contacts:", contacts);
  console.log("SearchResults - totalContacts:", totalContacts);

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
                  <CardTitle>Save 33 contacts</CardTitle>
                  <CardDescription>
                    Select which list to save your contacts to for future use.
                  </CardDescription>
                </div>
                <div className="ml-auto flex gap-2 items-center">
                  {/* Add a select here to choose a list */}
                  <Select>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button>
                    Save
                    <Check />
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
                        <h3 className="font-semibold truncate  text-2xl">
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
