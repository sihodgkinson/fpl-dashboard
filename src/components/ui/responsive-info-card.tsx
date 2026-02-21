"use client";

import * as React from "react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ResponsiveInfoCardProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

export function ResponsiveInfoCard({
  trigger,
  content,
  className,
}: ResponsiveInfoCardProps) {
  const [usePopover, setUsePopover] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const hoverNone = window.matchMedia("(hover: none)");
    const pointerCoarse = window.matchMedia("(pointer: coarse)");
    const update = () => setUsePopover(hoverNone.matches || pointerCoarse.matches);

    update();
    hoverNone.addEventListener("change", update);
    pointerCoarse.addEventListener("change", update);

    return () => {
      hoverNone.removeEventListener("change", update);
      pointerCoarse.removeEventListener("change", update);
    };
  }, []);

  if (usePopover) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="top"          // ✅ prefer above trigger
          sideOffset={4}      // ✅ small gap
          align="center"
          className={cn("z-50 !w-fit max-h-[80vh] max-w-[90vw] overflow-y-auto", className)}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side="top"          // ✅ prefer above trigger
        sideOffset={4}
        align="center"
        className={cn("z-50 !w-fit max-h-[80vh] max-w-[90vw] overflow-y-auto", className)}
      >
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}
