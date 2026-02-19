"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils"; // shadcn utility for merging class names

interface GameweekSelectorProps {
  selectedLeagueId: number;
  currentGw: number;
  maxGw: number;
  className?: string; // NEW
}

export function GameweekSelector({
  selectedLeagueId,
  currentGw,
  maxGw,
  className,
}: GameweekSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const selectedGw = Number(searchParams.get("gw")) || currentGw;

  const prefetchForGw = async (targetGw: number) => {
    if (!Number.isInteger(selectedLeagueId) || selectedLeagueId <= 0) return;

    const keys = [
      `/api/league?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
      `/api/transfers?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
      `/api/chips?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
    ];

    await Promise.all(
      keys.map((key) =>
        mutate(
          key,
          fetch(key).then((res) => {
            if (!res.ok) {
              throw new Error(`Prefetch failed: ${res.status}`);
            }
            return res.json();
          }),
          {
            populateCache: true,
            revalidate: false,
          }
        ).catch(() => undefined)
      )
    );
  };

  const updateGw = (gw: number) => {
    void prefetchForGw(gw);
    const params = new URLSearchParams(searchParams.toString());
    params.set("gw", String(gw));
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleChange = (value: string) => {
    updateGw(Number(value));
  };

  const handlePrev = () => {
    if (selectedGw > 1) {
      updateGw(selectedGw - 1);
    }
  };

  const handleNext = () => {
    if (selectedGw < maxGw) {
      updateGw(selectedGw + 1);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Select onValueChange={handleChange} value={String(selectedGw)}>
        <SelectTrigger className={cn("w-40", className)}>
          <SelectValue placeholder="Select GW" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: maxGw }, (_, i) => maxGw - i).map((gw) => (
            <SelectItem key={gw} value={String(gw)}>
              Gameweek {gw}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={handlePrev}
        disabled={selectedGw <= 1}
        className="h-12 w-12"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={selectedGw >= maxGw}
        className="h-12 w-12"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
