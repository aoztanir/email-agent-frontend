"use client";

import { motion } from "motion/react";
import { Shield, Mail, Database, Eye, Lock, Users, Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COLORS } from "@/constants/COLORS";

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  colorClass?: string;
}

function PolicySection({ icon, title, children, colorClass }: SectionProps) {
  return (
    <Card className={`${colorClass} mb-6`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon}
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant="outline">Last Updated: {new Date().toLocaleDateString()}</Badge>
            <Badge className={COLORS.blue.light_variant.class}>Google OAuth Compliant</Badge>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information when you use our email outreach platform.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <PolicySection
            icon={<Database className="w-6 h-6 text-blue-600" />}
            title="Information We Collect"
            colorClass={COLORS.blue.light_variant_with_border.class}
          >
            <div className="space-y-3">
              <h4 className="font-semibold">Google Account Information</h4>
              <p>When you connect your Google account, we access:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Email Address:</strong> To send emails on your behalf</li>
                <li><strong>Profile Information:</strong> Basic profile details for account identification</li>
                <li><strong>Gmail Access:</strong> To send outreach emails through your Gmail account</li>
              </ul>
              
              <h4 className="font-semibold mt-6">Business Information</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Company names and contact information you search for</li>
                <li>Email templates and campaigns you create</li>
                <li>Contact lists and prospect information you compile</li>
              </ul>
            </div>
          </PolicySection>

          <PolicySection
            icon={<Mail className="w-6 h-6 text-green-600" />}
            title="How We Use Google User Data"
            colorClass={COLORS.emerald.light_variant_with_border.class}
          >
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  Email Sending Service
                </h4>
                <p className="text-green-700 dark:text-green-300">
                  We use your Gmail account exclusively to send business outreach emails that you create and authorize. 
                  We do not read, store, or access your existing emails.
                </p>
              </div>
              
              <h4 className="font-semibold">Specific Uses:</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Email Delivery:</strong> Send personalized outreach emails to your prospects using your Gmail account</li>
                <li><strong>Authentication:</strong> Verify your identity and maintain secure access to our platform</li>
                <li><strong>Campaign Management:</strong> Track email delivery status and campaign performance</li>
                <li><strong>Account Security:</strong> Ensure secure access to your email sending capabilities</li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Limited Use Compliance
                </h4>
                <p className="text-blue-700 dark:text-blue-300">
                  Our use of Google user data is strictly limited to providing email sending services and complies with 
                  Google's Limited Use requirements. We do not use your data for advertising or other unrelated purposes.
                </p>
              </div>
            </div>
          </PolicySection>

          <PolicySection
            icon={<Lock className="w-6 h-6 text-purple-600" />}
            title="Data Security & Storage"
            colorClass={COLORS.purple.light_variant_with_border.class}
          >
            <div className="space-y-3">
              <h4 className="font-semibold">Security Measures</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Industry-standard encryption for data transmission and storage</li>
                <li>Secure authentication tokens with automatic expiration</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls limiting who can view your data</li>
              </ul>

              <h4 className="font-semibold mt-4">Data Retention</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Contact information: Stored until you delete it</li>
                <li>Email templates: Stored until you remove them</li>
                <li>Campaign data: Retained for performance tracking purposes</li>
                <li>Google tokens: Automatically expire and are refreshed as needed</li>
              </ul>
            </div>
          </PolicySection>

          <PolicySection
            icon={<Users className="w-6 h-6 text-orange-600" />}
            title="Data Sharing & Third Parties"
            colorClass={COLORS.orange.light_variant_with_border.class}
          >
            <div className="space-y-3">
              <p className="font-semibold text-orange-800 dark:text-orange-200">
                We do not sell, rent, or share your personal data with third parties for marketing purposes.
              </p>
              
              <h4 className="font-semibold">Limited Sharing Occurs Only For:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Service Providers:</strong> Trusted partners who help deliver our services (all bound by strict confidentiality)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and users' safety</li>
                <li><strong>Business Transfers:</strong> In the event of a merger or acquisition (with continued privacy protection)</li>
              </ul>
            </div>
          </PolicySection>

          <PolicySection
            icon={<Eye className="w-6 h-6 text-teal-600" />}
            title="Your Rights & Controls"
            colorClass={COLORS.teal.light_variant_with_border.class}
          >
            <div className="space-y-3">
              <h4 className="font-semibold">You Have the Right To:</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> View all data we have about you</li>
                <li><strong>Correct:</strong> Update or fix any incorrect information</li>
                <li><strong>Delete:</strong> Remove your account and all associated data</li>
                <li><strong>Export:</strong> Download your data in a portable format</li>
                <li><strong>Revoke Access:</strong> Disconnect your Google account at any time</li>
                <li><strong>Object:</strong> Opt-out of certain data processing activities</li>
              </ul>

              <div className="bg-teal-50 dark:bg-teal-950 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
                <p className="text-teal-700 dark:text-teal-300">
                  <strong>To exercise these rights or ask questions about your data, contact us at:</strong> privacy@[yourdomain].com
                </p>
              </div>
            </div>
          </PolicySection>

          <PolicySection
            icon={<Bell className="w-6 h-6 text-red-600" />}
            title="Updates & Contact"
            colorClass={COLORS.red.light_variant_with_border.class}
          >
            <div className="space-y-4">
              <h4 className="font-semibold">Policy Updates</h4>
              <p>
                We may update this Privacy Policy periodically. We'll notify you of significant changes via email 
                or through our platform. The "Last Updated" date at the top shows when this policy was last modified.
              </p>

              <h4 className="font-semibold">Contact Information</h4>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
                <p><strong>Email:</strong> privacy@[yourdomain].com</p>
                <p><strong>Data Protection Officer:</strong> dpo@[yourdomain].com</p>
                <p><strong>Address:</strong> [Your Business Address]</p>
              </div>

              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                  Questions About This Policy?
                </h4>
                <p className="text-red-700 dark:text-red-300">
                  If you have any questions about how we handle your data or this Privacy Policy, 
                  please don't hesitate to contact us. We're here to help and ensure your privacy is protected.
                </p>
              </div>
            </div>
          </PolicySection>

          <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
            <div className="text-center">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Your Privacy is Our Priority</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We're committed to protecting your privacy and being transparent about our data practices. 
                This policy reflects our dedication to earning and maintaining your trust.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}