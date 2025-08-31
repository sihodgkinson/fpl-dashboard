"use client";

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
  const gw = searchParams.get("gw") || currentGw;

  return (
    <Select
      defaultValue={String(selectedLeagueId)}
      onValueChange={(value) => {
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