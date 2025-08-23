"use client";

import { Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SendEmailsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Send Emails</h1>
        <p className="text-muted-foreground mt-2">
          Create and send email campaigns
        </p>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              New Campaign
            </CardTitle>
            <CardDescription>
              Create a new email campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Create Campaign</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}