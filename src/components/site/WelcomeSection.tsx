"use client";

import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COLORS } from "@/constants/COLORS";
import { Badge } from "../ui/badge";
import Logo from "../miscellaneous-components/logo";

interface FeatureCardProps {
  title: string;
  description: string;
  colorClass: string;
}

function FeatureCard({ title, description, colorClass }: FeatureCardProps) {
  return (
    <Card className={`${colorClass} h-full`}>
      <CardHeader>
        <CardTitle className="text-left font-serif">{title}</CardTitle>
        <CardDescription className="text-left text-xs">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

interface WelcomeSectionProps {
  hasSearched: boolean;
}

export default function WelcomeSection({ hasSearched }: WelcomeSectionProps) {
  if (hasSearched) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <Badge>
          <Logo className="text-primary-foreground" />
          <code>ERA-0</code>
        </Badge>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-9xl font-bold mb-4"
      >
        Y<i>o</i>ur N<i>e</i>tw<i>o</i>rk <i>O</i>p<i>e</i>n-S<i>o</i>ur<i>c</i>
        ed.
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 items-center gap-4"
      >
        <FeatureCard
          title="AI Company Discovery"
          description="Search any industry or location and let AI find real companies with addresses and descriptions."
          colorClass={COLORS.red.light_variant_with_border.class}
        />
        <FeatureCard
          title="Smart Email Patterns"
          description="AI analyzes each company's email format and generates accurate contact addresses automatically."
          colorClass={COLORS.amber.light_variant_with_border.class}
        />
        <FeatureCard
          title="Contact Discovery"
          description="Automatically finds key professionals at target companies and identifies decision makers."
          colorClass={COLORS.emerald.light_variant_with_border.class}
        />
        <FeatureCard
          title="Real-Time Streaming"
          description="Watch results appear instantly as companies, contacts, and email addresses are discovered live."
          colorClass={COLORS.blue.light_variant_with_border.class}
        />
      </motion.div>
    </motion.div>
  );
}
