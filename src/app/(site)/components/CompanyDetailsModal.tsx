"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ExternalLink,
  Building,
  Globe,
  MapPin,
  Phone,
  Mail,
  Users,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSearchStore } from "@/store/searchStore";

export default function CompanyDetailsModal() {
  const {
    selectedCompany,
    isModalOpen,
    contacts,
    isSearching,
    currentStatus,
    setIsModalOpen,
    setSelectedCompany,
  } = useSearchStore();

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
  };

  if (!selectedCompany) return null;

  const companyContacts = contacts[selectedCompany.id] || [];
  const confirmedEmails = companyContacts.reduce(
    (count, contact) =>
      count +
      contact.emails.filter(
        (email) =>
          email.is_deliverable === true ||
          email.confidence === "pattern_generated"
      ).length,
    0
  );

  const isLoadingContacts =
    isSearching && currentStatus?.includes(selectedCompany.name);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-4xl">
                  {selectedCompany?.name}
                </DialogTitle>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {selectedCompany.website && (
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      <a
                        href={selectedCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline truncate max-w-48"
                      >
                        {selectedCompany.website}
                      </a>
                    </div>
                  )}
                  {selectedCompany.phone_number && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{selectedCompany.phone_number}</span>
                    </div>
                  )}
                </div>
                {selectedCompany.address && (
                  <div className="flex items-start gap-1 mt-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {selectedCompany.address}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2"></div>
          </div>

          {/* Email Table */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl ">Contacts</h3>
              {isLoadingContacts && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding contacts...
                </div>
              )}
            </div>

            {companyContacts.length === 0 ? (
              <div className="text-center py-8">
                {isLoadingContacts ? (
                  <div>
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Discovering contacts for this company...
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No contacts found yet</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact Name</TableHead>
                      <TableHead className="text-right">
                        Email Address
                      </TableHead>
                      {/* <TableHead>Status</TableHead> */}
                      <TableHead className="text-right w-12">Profile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {companyContacts.flatMap((contact) =>
                        contact.emails.length > 0
                          ? contact.emails.map((email, emailIdx) => (
                              <motion.tr
                                key={`${contact.id}-${emailIdx}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: emailIdx * 0.05 }}
                              >
                                <TableCell className="font-medium">
                                  {contact.first_name} {contact.last_name}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge color="emerald" variant="light">
                                    {email.email}
                                  </Badge>
                                </TableCell>

                                <TableCell className="text-right w-12">
                                  <div className="flex justify-end">
                                    {contact.linkedin_url ? (
                                      <a
                                        href={contact.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 inline-flex"
                                        aria-label={`View ${contact.first_name} ${contact.last_name} on LinkedIn`}
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            ))
                          : [
                              <motion.tr
                                key={contact.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                              >
                                <TableCell className="font-medium">
                                  {contact.first_name} {contact.last_name}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground italic">
                                  No email generated
                                </TableCell>
                                <TableCell className="text-right w-12">
                                  <div className="flex justify-end">
                                    {contact.linkedin_url ? (
                                      <a
                                        href={contact.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 inline-flex"
                                        aria-label={`View ${contact.first_name} ${contact.last_name} on LinkedIn`}
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>,
                            ]
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
