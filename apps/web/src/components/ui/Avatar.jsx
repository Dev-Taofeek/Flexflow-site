"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import Image from "next/image";

export function Avatar({ src, alt, fallback, size = "md", className }) {
  const [hasError, setHasError] = React.useState(false);

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-lg",
  };

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border-border bg-muted text-foreground dark:border-border-dark dark:bg-muted-dark dark:text-foreground-dark border",
        sizes[size],
        className
      )}
    >
      {!hasError && src ? (
        <Image
          src={src}
          alt={alt || "Image"}
          className="h-full w-full object-cover"
          width={1200}
          height={480}
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-medium uppercase">{fallback?.slice(0, 2) || "?"}</span>
      )}
    </div>
  );
}
