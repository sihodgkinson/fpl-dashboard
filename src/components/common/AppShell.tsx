"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { AppSidebar, type AppSidebarItem, type AppSidebarSection } from "@/components/common/AppSidebar";
import { cn } from "@/lib/utils";

export function useAppShellNavigation() {
  const [useDrawerNav, setUseDrawerNav] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateDrawerMode = () => {
      const isNarrowMobile = window.matchMedia("(max-width: 639px)").matches;
      const isPhoneLandscape =
        window.matchMedia("(orientation: landscape)").matches &&
        window.innerHeight <= 540 &&
        window.innerWidth <= 1024;
      setUseDrawerNav(isNarrowMobile || isPhoneLandscape);
    };

    evaluateDrawerMode();
    window.addEventListener("resize", evaluateDrawerMode);
    window.addEventListener("orientationchange", evaluateDrawerMode);

    return () => {
      window.removeEventListener("resize", evaluateDrawerMode);
      window.removeEventListener("orientationchange", evaluateDrawerMode);
    };
  }, []);

  React.useEffect(() => {
    if (!useDrawerNav) {
      setMobileSidebarOpen(false);
    }
  }, [useDrawerNav]);

  return {
    useDrawerNav,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  };
}

interface AppShellProps {
  title: string;
  sections: AppSidebarSection[];
  footerItem?: AppSidebarItem;
  useDrawerNav: boolean;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  headerRight?: React.ReactNode;
  sidebarCollapsed?: boolean;
  mainClassName?: string;
  mainProps?: React.ComponentProps<"main">;
  children: React.ReactNode;
}

export function AppShell({
  title,
  sections,
  footerItem,
  useDrawerNav,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  headerRight,
  sidebarCollapsed = false,
  mainClassName,
  mainProps,
  children,
}: AppShellProps) {
  return (
    <div
      data-drawer-nav={useDrawerNav ? "true" : "false"}
      className={cn(
        "flex min-h-svh bg-background text-foreground",
        !useDrawerNav && "sm:h-svh sm:overflow-hidden"
      )}
    >
      <AppSidebar
        useDrawerNav={useDrawerNav}
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarOpenChange={onMobileSidebarOpenChange}
        sections={sections}
        footerItem={footerItem}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div
        className={cn(
          "mobile-landscape-scroll-shell flex min-h-svh flex-1 flex-col",
          !useDrawerNav && "sm:h-svh sm:min-h-0 sm:overflow-hidden"
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onMobileSidebarOpenChange(true)}
              className={cn(
                "inline-flex items-center justify-center rounded-md border border-border",
                useDrawerNav ? "h-10 w-10" : "h-9 w-9",
                !useDrawerNav && "sm:hidden"
              )}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          </div>
          {headerRight ? <div className="flex items-center gap-2">{headerRight}</div> : null}
        </header>

        <main
          className={cn(
            "mobile-landscape-scroll-main flex min-h-0 flex-1 flex-col gap-4 p-4 sm:gap-4 sm:p-4 md:p-4",
            !useDrawerNav && "sm:overflow-hidden",
            mainClassName
          )}
          {...mainProps}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
