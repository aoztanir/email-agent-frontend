"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProgressBannerProps {
  currentStage: string;
  currentStatus: string;
  isSearching: boolean;
  className?: string;
}

export default function ProgressBanner({
  currentStage,
  currentStatus,
  isSearching,
  className = ""
}: ProgressBannerProps) {
  if (!isSearching) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4 ${className}`}
    >
      <Alert className="bg-background/95 backdrop-blur border shadow-lg">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <AlertDescription className="font-medium text-sm">
            {currentStatus}
          </AlertDescription>
        </div>
      </Alert>
    </motion.div>
  );
}