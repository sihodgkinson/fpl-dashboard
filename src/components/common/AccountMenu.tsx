"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { LogOut, Monitor, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SessionResponse {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

interface AccountMenuProps {
  className?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as SessionResponse;
};

export function AccountMenu({ className }: AccountMenuProps) {
  const router = useRouter();
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { data, mutate } = useSWR<SessionResponse>("/api/auth/session", fetcher, {
    revalidateOnFocus: true,
  });

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [data?.user?.avatarUrl]);

  const user = data?.user;
  const name = user?.name || "Signed in user";
  const email = user?.email || "No email";
  const avatarUrl = !avatarFailed ? user?.avatarUrl : null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutate();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("h-12 w-12 rounded-full p-0", className)}
          aria-label="Account settings"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-full w-full rounded-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <User className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="space-y-1 px-4 py-3">
          <p className="text-sm font-semibold leading-none">{name}</p>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted-foreground">Theme</span>
          <div className="inline-flex rounded-md border p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("light")}
              aria-label="Set light theme"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("dark")}
              aria-label="Set dark theme"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-sm",
                theme === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => setTheme("system")}
              aria-label="Use system theme"
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          className="px-4 py-3"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
