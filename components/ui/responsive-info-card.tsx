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
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className={className}>{content}</PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className={className}>{content}</HoverCardContent>
    </HoverCard>
  );
}