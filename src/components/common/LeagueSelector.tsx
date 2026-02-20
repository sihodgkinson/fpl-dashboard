"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const searchParams = useSearchParams();
  const [optimisticLeagueId, setOptimisticLeagueId] = React.useState(selectedLeagueId);
  const gw = searchParams.get("gw") || currentGw;

  React.useEffect(() => {
    setOptimisticLeagueId(selectedLeagueId);
  }, [selectedLeagueId]);

  return (
    <Select
      value={String(optimisticLeagueId)}
      onValueChange={(value) => {
        const parsedValue = Number(value);
        if (Number.isInteger(parsedValue) && parsedValue > 0) {
          setOptimisticLeagueId(parsedValue);
        }
        router.push(`/dashboard?leagueId=${value}&gw=${gw}`);
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
