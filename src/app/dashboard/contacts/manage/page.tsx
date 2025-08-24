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
import { COLORS } from "@/constants/COLORS";
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Phone,
  Building,
  Search,
  MoreHorizontal,
  UserPlus,
  List,
  Grid,
  CheckCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

interface ContactCardProps {
  contact: Contact;
  isSelected?: boolean;
  onSelect?: (contactId: string) => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

function ContactCard({
  contact,
  isSelected = false,
  onSelect,
  onEdit,
  onRemove,
}: ContactCardProps) {
  return (
    <Card
      className={`hover:shadow-md transition-all duration-200 group cursor-pointer border ${
        isSelected ? "border-primary ring-1 ring-primary/20" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(contact.id)}
                className="mt-1"
              />
            )}
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {contact.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-left group-hover:text-opacity-80 transition-colors text-base truncate">
                {contact.name}
              </CardTitle>
              {contact.title && (
                <CardDescription className="text-left text-sm truncate">
                  {contact.title}
                </CardDescription>
              )}
              {contact.company_name && (
                <div className="flex items-center gap-1 mt-1">
                  <Building className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {contact.company_name}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {contact.email && (
              <Badge variant="secondary" className="text-xs">
                <Mail className="w-3 h-3 mr-1" />
                Email
              </Badge>
            )}
            {contact.phone && (
              <Badge variant="secondary" className="text-xs">
                <Phone className="w-3 h-3 mr-1" />
                Phone
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hover:bg-muted/50">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onRemove}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove from list
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManageContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
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
          contact:contact(*)
        `
        )
        .eq("contact_list_id", selectedListId);

      if (error) throw error;

      return data?.map((member: any) => member.contact as Contact) || [];
    },
    enabled: !!selectedListId,
  });

  // Fetch all contacts for adding to lists
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all-contacts"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contact")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
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
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableContacts = allContacts.filter(
    (contact) =>
      !listContacts.some((listContact) => listContact.id === contact.id)
  );

  const filteredAvailableContacts = availableContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Panel - Contact Lists */}
      <div className="w-80">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5" />
                <div>
                  <CardTitle>Contact Lists</CardTitle>
                  <CardDescription>
                    Organize your contacts into lists
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateList(true)}
                className={`${COLORS.blue.light_variant_with_border.class}`}
              >
                <Plus className="w-4 h-4" />
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
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{list.name}</h4>
                          {list.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {list.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {list.contact_count} contacts
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
                  <div className="flex items-center border rounded-lg p-1">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("table")}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddContacts(true)}
                    className={`${COLORS.green.light_variant_with_border.class}`}
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
              ) : viewMode === "grid" ? (
                <div className="h-full overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4 pr-2"
                  >
                    {filteredContacts.map((contact, index) => (
                      <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <ContactCard
                          contact={contact}
                          onRemove={() => handleRemoveContact(contact.id)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {contact.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {contact.name}
                                </div>
                                {contact.title && (
                                  <div className="text-sm text-muted-foreground">
                                    {contact.title}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.email || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.phone || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.company_name || "-"}
                          </TableCell>
                          <TableCell>
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
                  className={COLORS.green.light_variant_with_border.class}
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
                filteredAvailableContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContacts.includes(contact.id)}
                    onSelect={handleSelectContact}
                  />
                ))
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
