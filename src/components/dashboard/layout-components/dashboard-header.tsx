"use client";

import { Search, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader() {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const getBreadcrumbs = () => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];

    if (pathSegments.length > 1) {
      if (pathSegments[1] === "contacts") {
        breadcrumbs.push({ label: "Contacts", href: "/dashboard/contacts" });
        if (pathSegments[2] === "find") {
          breadcrumbs.push({
            label: "Find New Contacts",
            href: "/dashboard/contacts/find",
          });
        } else if (pathSegments[2] === "manage") {
          breadcrumbs.push({
            label: "My Contacts",
            href: "/dashboard/contacts/manage",
          });
        }
      } else if (pathSegments[1] === "emails") {
        breadcrumbs.push({ label: "Emails", href: "/dashboard/emails" });
        if (pathSegments[2] === "send") {
          breadcrumbs.push({
            label: "Send Emails",
            href: "/dashboard/emails/send",
          });
        } else if (pathSegments[2] === "sent") {
          breadcrumbs.push({
            label: "Sent Emails",
            href: "/dashboard/emails/sent",
          });
        }
      }
    }

    return breadcrumbs;
  };

  return (
    <header className="border-b bg-card px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <Breadcrumb>
            <BreadcrumbList>
              {getBreadcrumbs().map((crumb, index, array) => (
                <div key={crumb.href} className="flex items-center">
                  <BreadcrumbItem>
                    {index === array.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < array.length - 1 && <BreadcrumbSeparator />}
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Bell className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
