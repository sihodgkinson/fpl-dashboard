"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  showArrows?: boolean;
}

export function GameweekSelector({
  selectedLeagueId,
  currentGw,
  maxGw,
  className,
  showArrows = true,
}: GameweekSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const selectedGw = Number(searchParams.get("gw")) || currentGw;

  const prefetchForGw = async (targetGw: number) => {
    if (!Number.isInteger(selectedLeagueId) || selectedLeagueId <= 0) return;

    const keys = [
      `/api/league?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
      `/api/transfers?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
      `/api/chips?leagueId=${selectedLeagueId}&gw=${targetGw}&currentGw=${currentGw}`,
      `/api/stats-trend?leagueId=${selectedLeagueId}&gw=${targetGw}&window=8`,
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
    router.push(`${pathname || "/dashboard"}?${params.toString()}`, { scroll: false });
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
    <div className={cn("flex items-center gap-2", showArrows ? "w-fit sm:w-auto" : "w-full")}>
      <Select onValueChange={handleChange} value={String(selectedGw)}>
        <SelectTrigger className={cn(showArrows ? "w-[112px]" : "w-full", className)}>
          <SelectValue placeholder="GW" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: maxGw }, (_, i) => maxGw - i).map((gw) => (
            <SelectItem key={gw} value={String(gw)}>
              GW {gw}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showArrows ? (
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
          disabled={selectedGw <= 1}
          className="h-12 w-12"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : null}

      {showArrows ? (
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={selectedGw >= maxGw}
          className="h-12 w-12"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
