"use client";

import { motion } from "motion/react";
import {
  User,
  ExternalLink,
  Download,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface Company {
  id: string;
  name: string;
  website: string;
  address?: string;
  phone_number?: string;
  introduction?: string;
  is_existing?: boolean;
}

interface CompanyContactsModalProps {
  company: Company | null;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onSaveContacts?: (contacts: Contact[]) => void;
  showSaveOption?: boolean;
}

export default function CompanyContactsModal({
  company,
  contacts,
  isOpen,
  onClose,
  onSaveContacts,
  showSaveOption = true,
}: CompanyContactsModalProps) {
  if (!company) return null;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };


  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const copyAllEmails = () => {
    const allEmails = contacts
      .flatMap((contact) => (contact.emails || []).map((e) => e.email))
      .join(", ");
    navigator.clipboard.writeText(allEmails);
    toast.success(
      `${
        contacts.flatMap((c) => c.emails || []).length
      } emails copied to clipboard`
    );
  };

  const openLinkedIn = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const totalEmails = contacts.reduce(
    (sum, contact) => sum + (contact.emails?.length || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 overflow-y-scroll">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                {company.name} - Contacts
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {contacts.length} contacts • {totalEmails} email addresses
              </p>
            </div>
            <div className="flex items-center gap-2">
              {contacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllEmails}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy All Emails
                </Button>
              )}
              {showSaveOption && onSaveContacts && (
                <Button
                  onClick={() => onSaveContacts(contacts)}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Save Contacts
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 p-6">
          {contacts.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <User className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No contacts found</h3>
                <p className="text-muted-foreground">
                  We couldn't find any contacts for {company.name} yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contact Cards for Mobile */}
              <div className="block md:hidden space-y-4">
                {contacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(contact.first_name, contact.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </h4>
                        {contact.linkedin_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLinkedIn(contact.linkedin_url!)}
                            className="p-0 h-auto text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            LinkedIn
                          </Button>
                        )}
                      </div>
                      {contact.is_existing && (
                        <Badge variant="secondary">Existing</Badge>
                      )}
                    </div>

                    {contact.emails && contact.emails.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">
                          Email Addresses ({contact.emails?.length || 0})
                        </h5>
                        <div className="space-y-1">
                          {(contact.emails || []).map((email, emailIndex) => (
                            <div
                              key={emailIndex}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span
                                className="font-mono cursor-pointer hover:text-primary"
                                onClick={() => copyEmail(email.email)}
                              >
                                {email.email}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Table for Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Emails</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      {/* <TableHead>Status</TableHead> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {getInitials(
                                  contact.first_name,
                                  contact.last_name
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {contact.first_name} {contact.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {company.name}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(contact.emails || []).map((email, emailIndex) => (
                              <div
                                key={emailIndex}
                                className="flex items-center gap-2"
                              >
                                <span
                                  className="font-mono text-sm cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => copyEmail(email.email)}
                                >
                                  {email.email}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.linkedin_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openLinkedIn(contact.linkedin_url!)
                              }
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              —
                            </span>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
