"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bell, LogOut, MoreVertical, Settings, User, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
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

const sessionFetcher = async (url: string) => {
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
  const { data, mutate: mutateSession } = useSWR<SessionResponse>(
    "/api/auth/session",
    sessionFetcher,
    {
      revalidateOnFocus: true,
    }
  );

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [data?.user?.avatarUrl]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutateSession();
    router.push("/");
    router.refresh();
  }

  const user = data?.user;
  const name = user?.name || "Signed in user";
  const email = user?.email || "No email";
  const avatarUrl = !avatarFailed ? user?.avatarUrl : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-12 w-full items-center justify-between rounded-lg px-3 text-left transition-colors hover:bg-muted/70",
            className
          )}
          aria-label="Open account menu"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-none">{name}</p>
              <p className="truncate pt-px text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-64 p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background">
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
          </div>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold leading-none">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1.5">
          <DropdownMenuItem disabled className="h-9 rounded-md px-2.5 text-sm">
            <UserCircle className="h-4 w-4" />
            Account (Coming Soon)
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="h-9 rounded-md px-2.5 text-sm">
            <Bell className="h-4 w-4" />
            Notifications (Coming Soon)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-9 rounded-md px-2.5 text-sm"
            onSelect={(event) => {
              event.preventDefault();
              setTheme(theme === "dark" ? "light" : "dark");
            }}
          >
            <Settings className="h-4 w-4" />
            Theme: {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"}
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1.5">
          <DropdownMenuItem className="h-10 rounded-md px-2.5 text-base" onSelect={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
