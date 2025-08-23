"use client";

import { useState } from "react";
import {
  Users,
  Mail,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { cn } from "@/lib/utils";
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

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  hasSubmenu?: boolean;
  submenuItems?: { label: string; href: string }[];
  isExpanded?: boolean;
}

function SidebarItem({
  icon,
  label,
  hasSubmenu = false,
  submenuItems = [],
  isExpanded = true,
}: SidebarItemProps) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const pathname = usePathname();

  const handleClick = () => {
    if (hasSubmenu) {
      setShowSubmenu(!showSubmenu);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-accent hover:text-accent-foreground",
          !isExpanded && "justify-center"
        )}
      >
        <div className="flex-shrink-0">{icon}</div>
        {isExpanded && <span className="flex-1 text-left">{label}</span>}
        {hasSubmenu && isExpanded && (
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform",
              showSubmenu && "rotate-90"
            )}
          />
        )}
      </button>

      {hasSubmenu && showSubmenu && isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {submenuItems.map((item, index) => (
            <SidebarSubItem
              key={index}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarSubItem({
  item,
  isActive,
}: {
  item: { label: string; href: string };
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "block w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {item.label}
    </Link>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const getBreadcrumbs = () => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }];
    
    if (pathSegments.length > 1) {
      if (pathSegments[1] === 'contacts') {
        breadcrumbs.push({ label: 'Contacts', href: '/dashboard/contacts' });
        if (pathSegments[2] === 'find') {
          breadcrumbs.push({ label: 'Find New Contacts', href: '/dashboard/contacts/find' });
        } else if (pathSegments[2] === 'manage') {
          breadcrumbs.push({ label: 'My Contacts', href: '/dashboard/contacts/manage' });
        }
      } else if (pathSegments[1] === 'emails') {
        breadcrumbs.push({ label: 'Emails', href: '/dashboard/emails' });
        if (pathSegments[2] === 'send') {
          breadcrumbs.push({ label: 'Send Emails', href: '/dashboard/emails/send' });
        } else if (pathSegments[2] === 'sent') {
          breadcrumbs.push({ label: 'Sent Emails', href: '/dashboard/emails/sent' });
        }
      }
    }
    
    return breadcrumbs;
  };

  const sidebarItems = [
    {
      icon: <Users className="w-4 h-4" />,
      label: "Contacts",
      hasSubmenu: true,
      submenuItems: [
        { label: "Find new contacts", href: "/dashboard/contacts/find" },
        { label: "My Contacts", href: "/dashboard/contacts/manage" },
      ],
    },
    {
      icon: <Mail className="w-4 h-4" />,
      label: "Send emails",
      hasSubmenu: true,
      submenuItems: [
        { label: "Send", href: "/dashboard/emails/send" },
        { label: "Sent", href: "/dashboard/emails/sent" },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "relative border-r bg-card transition-all duration-300 ease-in-out",
          sidebarExpanded ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="border-b p-4">
            <div
              className={cn(
                "flex items-center gap-2",
                !sidebarExpanded && "justify-center"
              )}
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              {sidebarExpanded && (
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">Email Agent</h2>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {sidebarItems.map((item, index) => (
                <SidebarItem
                  key={index}
                  icon={item.icon}
                  label={item.label}
                  hasSubmenu={item.hasSubmenu}
                  submenuItems={item.submenuItems}
                  isExpanded={sidebarExpanded}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Expand/Collapse indicator */}
        <div
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-border rounded-full flex items-center justify-center transition-opacity",
            sidebarExpanded ? "opacity-100" : "opacity-0"
          )}
        >
          <ChevronLeft className="w-3 h-3" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b bg-card px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>;
}
