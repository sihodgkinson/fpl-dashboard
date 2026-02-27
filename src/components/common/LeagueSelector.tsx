"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // shadcn utility for merging class names

interface League {
  id: number;
  name: string;
}

interface LeagueSelectorProps {
  leagues: League[];
  selectedLeagueId: number;
  currentGw: number;
  className?: string; // NEW
}

export function LeagueSelector({
  leagues,
  selectedLeagueId,
  currentGw,
  className,
}: LeagueSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [optimisticLeagueId, setOptimisticLeagueId] = React.useState(selectedLeagueId);
  const [singleLeagueHintOpen, setSingleLeagueHintOpen] = React.useState(false);
  const gw = searchParams.get("gw") || currentGw;

  React.useEffect(() => {
    setOptimisticLeagueId(selectedLeagueId);
  }, [selectedLeagueId]);

  React.useEffect(() => {
    if (!singleLeagueHintOpen) return;
    const timer = window.setTimeout(() => {
      setSingleLeagueHintOpen(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [singleLeagueHintOpen]);

  if (leagues.length <= 1) {
    const singleLeagueName = leagues[0]?.name || "No leagues";
    return (
      <Popover open={singleLeagueHintOpen} onOpenChange={setSingleLeagueHintOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-56 justify-start overflow-hidden text-left",
              className
            )}
            onClick={() => setSingleLeagueHintOpen(true)}
            aria-label={singleLeagueName}
          >
            <span className="truncate">{singleLeagueName}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto px-3 py-2 text-xs">
          Add another league to enable switching.
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Select
      value={String(optimisticLeagueId)}
      onValueChange={(value) => {
        const parsedValue = Number(value);
        if (Number.isInteger(parsedValue) && parsedValue > 0) {
          setOptimisticLeagueId(parsedValue);
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("leagueId", value);
        params.set("gw", String(gw));
        router.push(`${pathname || "/dashboard"}?${params.toString()}`);
      }}
    >
      <SelectTrigger className={cn("w-56", className)}>
        <SelectValue placeholder="Select League" />
      </SelectTrigger>
      <SelectContent>
        {leagues.map((league) => (
          <SelectItem key={league.id} value={String(league.id)}>
            {league.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
