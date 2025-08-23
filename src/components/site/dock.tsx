"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import React from "react";

import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Dock, DockIcon } from "@/components/magicui/dock";
import { ModeToggle } from "../ui/mode-toggle";
import { COLORS } from "@/constants/COLORS";

export type IconProps = React.HTMLAttributes<SVGElement>;

const Icons = {
  linkedin: (props: IconProps) => (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>LinkedIn</title>
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  ),
};

export function DockDemo() {
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
      <TooltipProvider>
        <Dock
          direction="middle"
          className={`shadow-xl ${COLORS.orange.light_variant_with_border.class}`}
        >
          {/* App name */}
          <div className="px-4 py-2 text-lg font-serif">Email Agent</div>

          <Separator orientation="vertical" className="h-full" />

          {/* Login Button */}
          <DockIcon>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/login"
                  aria-label="Login"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-12 rounded-full"
                  )}
                >
                  <LogIn className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Login</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>

          <Separator orientation="vertical" className="h-full" />

          {/* LinkedIn */}
          <DockIcon>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="https://linkedin.com"
                  aria-label="LinkedIn"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-12 rounded-full"
                  )}
                >
                  <Icons.linkedin className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>LinkedIn</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>

          <Separator orientation="vertical" className="h-full py-2" />

          {/* Mode Toggle */}
          <DockIcon>
            <Tooltip>
              <TooltipTrigger asChild>
                <ModeToggle variant="ghost" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Theme</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>
        </Dock>
      </TooltipProvider>
    </div>
  );
}
