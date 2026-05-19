import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";

import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-500 focus-visible:ring-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400",
  secondary:
    "border border-border bg-surface text-foreground shadow-sm hover:bg-muted focus-visible:ring-brand-500 dark:bg-surface-dark dark:hover:bg-muted-dark",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-brand-500 dark:hover:bg-muted-dark dark:hover:text-foreground-dark",
  destructive:
    "bg-danger-600 text-white shadow-sm hover:bg-danger-500 focus-visible:ring-danger-500 dark:bg-danger-500 dark:hover:bg-danger-400",
};

const sizes = {
  sm: "h-8 rounded-md px-3 text-xs",
  md: "h-10 rounded-md px-4 text-sm",
  lg: "h-12 rounded-lg px-6 text-base",
  icon: "h-10 w-10 rounded-md p-0",
};

export const Button = React.forwardRef(
  (
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      isLoading = false,
      disabled = false,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
          "transition-colors duration-150 ease-out",
          "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <Slottable>{children}</Slottable>
      </Comp>
    );
  }
);

Button.displayName = "Button";
