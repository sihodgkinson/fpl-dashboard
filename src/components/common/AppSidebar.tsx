"use client";

import Link from "next/link";
import { Settings, X, type LucideIcon } from "lucide-react";
import { AccountMenu } from "@/components/common/AccountMenu";
import { cn } from "@/lib/utils";

export interface AppSidebarItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  placeholder?: boolean;
}

export interface AppSidebarSection {
  key: string;
  label: string;
  items: AppSidebarItem[];
}

interface AppSidebarProps {
  useDrawerNav: boolean;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  sections: AppSidebarSection[];
  sidebarCollapsed?: boolean;
  footerItem?: AppSidebarItem;
}

export function AppSidebar({
  useDrawerNav,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  sections,
  sidebarCollapsed = false,
  footerItem,
}: AppSidebarProps) {
  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-border bg-muted/20 sm:flex sm:flex-col sm:transition-[width] sm:duration-200",
          useDrawerNav && "sm:hidden",
          sidebarCollapsed ? "sm:w-16" : "sm:w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border",
            sidebarCollapsed ? "justify-center" : "justify-between gap-2",
            sidebarCollapsed ? "px-2" : "px-3"
          )}
        >
          {!sidebarCollapsed ? (
            <Link href="/" className="flex items-center gap-2 overflow-hidden transition-opacity hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-light.svg" alt="GameweekIQ logo" className="h-7 w-7 object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-dark.svg" alt="GameweekIQ logo" className="hidden h-7 w-7 object-contain dark:block" />
              <span className="text-sm font-medium">GameweekIQ</span>
            </Link>
          ) : null}
        </div>

        {sections.map((section, sectionIndex) => (
          <div key={section.key}>
            <div className={cn(sectionIndex === 0 ? "mt-4" : "mt-4", sidebarCollapsed ? "px-2" : "px-3")}>
              {!sidebarCollapsed ? (
                <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground">
                  {section.label}
                </p>
              ) : null}
            </div>

            <nav className={cn("mt-2 flex flex-col gap-0.5", sidebarCollapsed ? "px-2" : "px-3")}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const itemClasses = cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-150",
                  item.active
                    ? "bg-muted/70 text-foreground"
                    : item.placeholder
                      ? "text-foreground"
                      : "text-foreground hover:bg-muted/70 hover:text-foreground",
                  sidebarCollapsed && "mx-auto w-8 justify-center px-0",
                  item.placeholder && "pointer-events-none cursor-default opacity-50"
                );

                if (item.placeholder) {
                  return (
                    <div key={item.key} className={itemClasses} aria-disabled="true">
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed ? <span>{item.label}</span> : null}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={itemClasses}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div
          className={cn(
            "mt-1 flex flex-1 flex-col gap-3 overflow-y-auto",
            sidebarCollapsed ? "px-2" : "px-3"
          )}
        />

        <div className={cn("space-y-0.5 pb-3", sidebarCollapsed ? "px-2" : "px-3")} data-sidebar-interactive="true">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-sm text-foreground opacity-50 disabled:pointer-events-none"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
          {footerItem ? (
            <Link
              href={footerItem.href}
              className={cn(
                "inline-flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-150",
                footerItem.active
                  ? "bg-muted/70 text-foreground"
                  : "text-foreground hover:bg-muted/70 hover:text-foreground",
                sidebarCollapsed && "mx-auto w-8 justify-center px-0"
              )}
            >
              <footerItem.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? <span>{footerItem.label}</span> : null}
            </Link>
          ) : null}
          <AccountMenu className="mt-2 w-full" />
        </div>
      </aside>

      {useDrawerNav && mobileSidebarOpen ? (
        <>
          <button
            type="button"
            className={cn("fixed inset-0 z-40 bg-background/70", !useDrawerNav && "sm:hidden")}
            onClick={() => onMobileSidebarOpenChange(false)}
            aria-label="Close sidebar"
          />
          <aside className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-screen max-w-[420px] flex-col gap-4 border-r border-border bg-background px-4 pb-4 shadow-2xl",
            !useDrawerNav && "sm:hidden"
          )}>
            <div className="mx-[-16px] flex h-16 items-center justify-between border-b border-border px-4">
              <Link
                href="/"
                onClick={() => onMobileSidebarOpenChange(false)}
                className="flex items-center gap-2 transition-opacity hover:opacity-90"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-light.svg" alt="GameweekIQ logo" className="h-7 w-7 object-contain dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-dark.svg" alt="GameweekIQ logo" className="hidden h-7 w-7 object-contain dark:block" />
                <span className="text-sm font-medium">GameweekIQ</span>
              </Link>
              <button
                type="button"
                onClick={() => onMobileSidebarOpenChange(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sections.map((section) => (
              <div key={section.key}>
                <div>
                  <p className="pb-1 text-xs font-medium text-muted-foreground">
                    {section.label}
                  </p>
                </div>

                <nav className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const itemClasses = cn(
                      "inline-flex h-12 items-center rounded-md px-4 text-base transition-colors duration-150",
                      item.active
                        ? "bg-muted/70 text-foreground"
                        : item.placeholder
                          ? "text-foreground"
                          : "text-foreground hover:bg-muted/70 hover:text-foreground",
                      item.placeholder && "pointer-events-none cursor-default opacity-50"
                    );

                    if (item.placeholder) {
                      return (
                        <div key={item.key} className={itemClasses} aria-disabled="true">
                          <Icon className="mr-2 h-5 w-5 shrink-0" />
                          {item.label}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={itemClasses}
                      >
                        <Icon className="mr-2 h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}

            <div className="mt-auto space-y-1" data-sidebar-interactive="true">
              <button
                type="button"
                disabled
                className="inline-flex h-12 w-full items-center gap-2 rounded-md px-4 text-base text-foreground opacity-50 disabled:pointer-events-none"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </button>
              {footerItem ? (
                <Link
                  href={footerItem.href}
                  className={cn(
                    "inline-flex h-12 w-full items-center gap-2 rounded-md px-4 text-base transition-colors duration-150",
                    footerItem.active
                      ? "bg-muted/70 text-foreground"
                      : "text-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <footerItem.icon className="h-5 w-5 shrink-0" />
                  <span>{footerItem.label}</span>
                </Link>
              ) : null}
              <AccountMenu className="mt-2 w-full" touchMode />
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
