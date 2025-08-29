"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GameweekSelectorProps {
  currentGw: number;
  maxGw: number;
}

export function GameweekSelector({ currentGw, maxGw }: GameweekSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedGw = Number(searchParams.get("gw")) || currentGw;

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gw", value);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="ml-auto w-40">
      <Select onValueChange={handleChange} value={String(selectedGw)}>
        <SelectTrigger>
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
    </div>
  );
}