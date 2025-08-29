"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GameweekSelectorProps {
  currentGw: number;
  maxGw: number;
}

export function GameweekSelector({ currentGw, maxGw }: GameweekSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedGw = Number(searchParams.get("gw")) || currentGw;

  const updateGw = (gw: number) => {
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
    <div className="flex items-center gap-2">
      <Select onValueChange={handleChange} value={String(selectedGw)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select GW" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: maxGw }, (_, i) => i + 1).map((gw) => (
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
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={selectedGw >= maxGw}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}