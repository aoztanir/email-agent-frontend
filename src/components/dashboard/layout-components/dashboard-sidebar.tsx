"use client";

import { Users, Mail, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/dashboard/layout-components/nav-user";
import Logo from "@/components/miscellaneous-components/logo";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

export function DashboardSidebar() {
  const { setOpen, open } = useSidebar();
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      icon: <Search className="w-4 h-4" />,
      label: "Find contacts",
      href: "/dashboard/contacts/find",
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: "My contacts",
      href: "/dashboard/contacts/manage",
    },
    {
      icon: <Mail className="w-4 h-4" />,
      label: "Send emails",
      href: "/dashboard/send-emails",
    },
    {
      icon: <FileText className="w-4 h-4" />,
      label: "Templates",
      href: "/dashboard/templates",
    },
  ];

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  return (
    <Sidebar
      collapsible="icon"
      className="group/sidebar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className={"py-4"}>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-accent "
        >
          <div
            className={
              "flex aspect-square size-8 items-center rounded-lg w-full " +
              (open ? "justify-between" : "justify-center")
            }
          >
            <Logo size={open ? 30 : 25} />
          </div>
          <div className="grid  text-right text-lg leading-tight text-nowrap">
            <code>ERA-0</code>
            <p className="text-xs text-muted-foreground">
              Networking, open-sourced.
            </p>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
