"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef(({ className, sideOffset = 8, ...props }, ref) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "border-border bg-foreground text-background z-50 max-w-xs overflow-hidden rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm",
          "animate-in fade-in-0 zoom-in-95",
          "dark:border-border-dark dark:bg-foreground-dark dark:text-background-dark",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

TooltipContent.displayName = TooltipPrimitive.Content.displayName;
