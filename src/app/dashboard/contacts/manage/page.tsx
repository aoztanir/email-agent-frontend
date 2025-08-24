"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// COLORS import removed - using direct Tailwind classes
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Building,
  Search,
  MoreHorizontal,
  UserPlus,
  List,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { COLORS } from "@/constants/COLORS";

interface ContactList {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  contact_count?: number;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company_name?: string;
  linkedin_url?: string;
  created_at: string;
}

// ContactCardProps interface removed - using table view only

// ContactCard component removed - using table view only

export default function ManageContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newList, setNewList] = useState({
    name: "",
    description: "",
  });
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch contact lists
  const { data: contactLists = [], isLoading: isLoadingLists } = useQuery({
    queryKey: ["contact-lists"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contact_list")
        .select(
          `
          *,
          contact_list_members:contact_list_member(
            contact_id
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((list) => ({
        ...list,
        contact_count: list.contact_list_members?.length || 0,
      }));
    },
  });

  // Fetch contacts for selected list
  const { data: listContacts = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: ["list-contacts", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];

      const { data, error } = await supabase
        .from("contact_list_member")
        .select(
          `
          contact_id,
          contact:contact(
            id,
            first_name,
            last_name,
            linkedin_url,
            created_at,
            company:company(
              name
            ),
            contact_emails:contact_email(
              email
            )
          )
        `
        )
        .eq("contact_list_id", selectedListId);

      if (error) throw error;

      return (
        data?.map((member: any) => {
          const contact = member.contact;
          return {
            id: contact.id,
            name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
            email: contact.contact_emails?.[0]?.email || undefined,
            phone: undefined, // Not stored in current schema
            title: undefined, // Not stored in current schema
            company_name: contact.company?.name || undefined,
            linkedin_url: contact.linkedin_url,
            created_at: contact.created_at,
          } as Contact;
        }) || []
      );
    },
    enabled: !!selectedListId,
  });

  // Fetch all user's contacts via the user_contact join table
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all-contacts"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_contact")
        .select(
          `
          contact:contact(
            id,
            first_name,
            last_name,
            linkedin_url,
            created_at,
            company:company(
              name
            ),
            contact_emails:contact_email(
              email
            )
          )
        `
        )
        .eq("user_id", user.id)
        .order("discovered_at", { ascending: false });

      if (error) throw error;
      return (
        data?.map((uc: any) => {
          const contact = uc.contact;
          return {
            id: contact.id,
            name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
            email: contact.contact_emails?.[0]?.email || undefined,
            phone: undefined, // Not stored in current schema
            title: undefined, // Not stored in current schema
            company_name: contact.company?.name || undefined,
            linkedin_url: contact.linkedin_url,
            created_at: contact.created_at,
          } as Contact;
        }) || []
      );
    },
  });

  // Create contact list mutation
  const createListMutation = useMutation({
    mutationFn: async (listData: { name: string; description?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contact_list")
        .insert({
          user_id: user.id,
          name: listData.name.trim(),
          description: listData.description?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Contact list created successfully!");
      queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      handleCloseCreateList();
    },
    onError: () => {
      toast.error("Failed to create contact list");
    },
  });

  // Add contacts to list mutation
  const addContactsToListMutation = useMutation({
    mutationFn: async ({
      listId,
      contactIds,
    }: {
      listId: string;
      contactIds: string[];
    }) => {
      const membersToInsert = contactIds.map((contactId) => ({
        contact_list_id: listId,
        contact_id: contactId,
      }));

      const { error } = await supabase
        .from("contact_list_member")
        .insert(membersToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacts added to list successfully!");
      queryClient.invalidateQueries({
        queryKey: ["list-contacts", selectedListId],
      });
      queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      setSelectedContacts([]);
      setShowAddContacts(false);
    },
    onError: () => {
      toast.error("Failed to add contacts to list");
    },
  });

  // Remove contact from list mutation
  const removeContactFromListMutation = useMutation({
    mutationFn: async ({
      listId,
      contactId,
    }: {
      listId: string;
      contactId: string;
    }) => {
      const { error } = await supabase
        .from("contact_list_member")
        .delete()
        .eq("contact_list_id", listId)
        .eq("contact_id", contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact removed from list");
      queryClient.invalidateQueries({
        queryKey: ["list-contacts", selectedListId],
      });
      queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
    },
    onError: () => {
      toast.error("Failed to remove contact from list");
    },
  });

  const handleCreateList = async () => {
    if (!newList.name.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    createListMutation.mutate(newList);
  };

  const handleCloseCreateList = () => {
    setShowCreateList(false);
    setNewList({ name: "", description: "" });
    setEditingList(null);
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleAddSelectedContacts = () => {
    if (!selectedListId || selectedContacts.length === 0) return;
    addContactsToListMutation.mutate({
      listId: selectedListId,
      contactIds: selectedContacts,
    });
  };

  const handleRemoveContact = (contactId: string) => {
    if (!selectedListId) return;
    removeContactFromListMutation.mutate({
      listId: selectedListId,
      contactId,
    });
  };

  const filteredContacts = listContacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableContacts = allContacts.filter(
    (contact) =>
      !listContacts.some((listContact) => listContact.id === contact.id)
  );

  const filteredAvailableContacts = availableContacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique companies from current list contacts
  const uniqueCompanies = [
    ...new Set(
      listContacts.map((contact) => contact.company_name).filter(Boolean)
    ),
  ];
  const companyNames =
    uniqueCompanies.slice(0, 3).join(", ") +
    (uniqueCompanies.length > 3
      ? `, and ${uniqueCompanies.length - 3} more`
      : "");

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left Panel - Contact Lists */}
      <div className="w-72">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="w-4 h-4" /> Contact Lists
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Organize your contacts
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateList(true)}
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden">
            {isLoadingLists ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : contactLists.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg mb-2">No lists yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first contact list to get started
                </p>
                <Button onClick={() => setShowCreateList(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create first list
                </Button>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {contactLists.map((list) => (
                  <Card
                    key={list.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedListId === list.id
                        ? "border-primary ring-1 ring-primary/20"
                        : ""
                    }`}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <CardContent className="">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {list.name}
                          </h4>
                          {list.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate">
                              {list.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-2">
                            <Badge variant="light" color="orange">
                              <Users className="w-3 h-3 mr-1" />
                              {list.contact_count}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - List Contacts */}
      <div className="flex-1">
        {selectedListId ? (
          <Card className="h-full flex flex-col">
            {/* Statistics Banner */}

            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {contactLists.find((list) => list.id === selectedListId)
                      ?.name || "Contact List"}
                  </CardTitle>
                  <CardDescription>
                    {filteredContacts.length} contacts in this list
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="light"
                    size="sm"
                    onClick={() => setShowAddContacts(true)}
                    color="orange"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add contacts
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              {isLoadingContacts ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg mb-2">
                    {listContacts.length === 0
                      ? "No contacts in this list"
                      : "No matching contacts"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {listContacts.length === 0
                      ? "Add some contacts to get started"
                      : "Try adjusting your search terms"}
                  </p>
                  {listContacts.length === 0 && (
                    <Button onClick={() => setShowAddContacts(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add contacts
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Statistics Banner - Fixed outside scroll area */}
                  {listContacts.length > 0 && (
                    <div
                      className={
                        "px-6 py-4 rounded-lg mb-4 " +
                        COLORS.indigo.light_variant_with_border.class
                      }
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">
                          Displaying {filteredContacts.length} contacts from{" "}
                          {uniqueCompanies.length} companies
                          {uniqueCompanies.length > 0 && (
                            <span className="ml-1">
                              including {companyNames}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Table Container */}
                  <div className="flex-1 min-h-0">
                    <div className="h-full border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background border-b z-10">
                          <TableRow>
                            <TableHead className="w-48">
                              Contact
                            </TableHead>
                            <TableHead className="w-48">
                              Email
                            </TableHead>
                            <TableHead className="w-36">
                              Company
                            </TableHead>
                            <TableHead className="w-28">
                              LinkedIn
                            </TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell className="w-48">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-8 h-8 flex-shrink-0">
                                    <AvatarFallback className="bg-blue-50 text-blue-700 text-xs">
                                      {contact.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">
                                      {contact.name}
                                    </div>
                                    {contact.title && (
                                      <div className="text-sm text-muted-foreground truncate">
                                        {contact.title}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="w-48">
                                {contact.email ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Mail className="w-3 h-3 text-green-600 flex-shrink-0" />
                                    <span className="text-sm truncate">
                                      {contact.email}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="w-36">
                                {contact.company_name ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Building className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                    <span className="text-sm truncate">
                                      {contact.company_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="w-28">
                                {contact.linkedin_url ? (
                                  <a
                                    href={contact.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">LinkedIn</span>
                                  </a>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="w-24">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleRemoveContact(contact.id)
                                      }
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Remove from list
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center">
              <List className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl mb-2">Select a contact list</h3>
              <p className="text-muted-foreground">
                Choose a contact list from the left panel to view and manage
                contacts
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Create List Sheet */}
      <Sheet open={showCreateList} onOpenChange={setShowCreateList}>
        <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="!font-sans">
              {editingList ? "Edit Contact List" : "Create New Contact List"}
            </SheetTitle>
            <SheetDescription>
              {editingList
                ? "Update your contact list details"
                : "Create a new list to organize your contacts"}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="mt-4 space-y-4 px-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                List Name *
              </label>
              <Input
                placeholder="e.g., Potential Clients, Follow-up Prospects"
                value={newList.name}
                onChange={(e) =>
                  setNewList({ ...newList, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">
                Description
              </label>
              <Textarea
                placeholder="Brief description of this contact list..."
                value={newList.description}
                onChange={(e) =>
                  setNewList({ ...newList, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreateList}
                className="flex-1"
                disabled={!newList.name.trim() || createListMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {createListMutation.isPending
                  ? "Creating..."
                  : editingList
                  ? "Update List"
                  : "Create List"}
              </Button>
              <Button variant="ghost" onClick={handleCloseCreateList}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Contacts Sheet */}
      <Sheet open={showAddContacts} onOpenChange={setShowAddContacts}>
        <SheetContent side="right" className="w-[700px] sm:max-w-[700px]">
          <SheetHeader>
            <SheetTitle className="!font-sans">Add Contacts to List</SheetTitle>
            <SheetDescription>
              Select contacts to add to "
              {contactLists.find((list) => list.id === selectedListId)?.name}"
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="mt-4 space-y-4 px-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search available contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {selectedContacts.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">
                  {selectedContacts.length} contact
                  {selectedContacts.length !== 1 ? "s" : ""} selected
                </span>
                <Button
                  size="sm"
                  onClick={handleAddSelectedContacts}
                  disabled={addContactsToListMutation.isPending}
                  className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {addContactsToListMutation.isPending
                    ? "Adding..."
                    : "Add Selected"}
                </Button>
              </div>
            )}

            <div className="h-[500px] overflow-y-auto space-y-3 pr-2">
              {availableContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg mb-2">
                    All contacts are in this list
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    There are no additional contacts to add to this list.
                  </p>
                </div>
              ) : filteredAvailableContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg mb-2">No matching contacts</h3>
                  <p className="text-muted-foreground text-sm">
                    Try adjusting your search terms to find contacts.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableContacts.map((contact) => (
                    <Card
                      key={contact.id}
                      className="p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() =>
                            handleSelectContact(contact.id)
                          }
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-blue-50 text-blue-700 text-xs">
                            {contact.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {contact.name}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            {contact.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-green-600" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {contact.email}
                                </span>
                              </div>
                            )}
                            {contact.company_name && (
                              <div className="flex items-center gap-1">
                                <Building className="w-3 h-3 text-blue-600" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {contact.company_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => setShowAddContacts(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
