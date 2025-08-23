"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManageContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Contacts</h1>
        <p className="text-muted-foreground mt-2">
          Manage your existing contact database
        </p>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact List</CardTitle>
            <CardDescription>
              View and manage all your contacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              No contacts found. Start by finding new contacts.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}