"use client";

import { Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SentEmailsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sent Emails</h1>
        <p className="text-muted-foreground mt-2">
          View your sent email campaigns and their performance
        </p>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" />
              Campaign History
            </CardTitle>
            <CardDescription>
              Track the performance of your sent campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              No campaigns sent yet. Create your first campaign.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}