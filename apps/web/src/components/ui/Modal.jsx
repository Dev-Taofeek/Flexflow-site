"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

export function Modal({ open, onOpenChange, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function ModalTrigger(props) {
  return <DialogPrimitive.Trigger {...props} />;
}

export function ModalPortal(props) {
  return <DialogPrimitive.Portal {...props} />;
}

export const ModalOverlay = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const ModalContent = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <DialogPrimitive.Portal>
      <ModalOverlay />

      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2",
          "border-border bg-surface rounded-2xl border p-6 shadow-md",
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "dark:border-border-dark dark:bg-surface-dark",
          className
        )}
        {...props}
      >
        {children}

        <DialogPrimitive.Close
          className={cn(
            "absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors duration-150 ease-out",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none",
            "dark:text-muted-foreground-dark dark:hover:bg-muted-dark dark:hover:text-foreground-dark"
          )}
        >
          <X className="h-4 w-4" />

          <span className="sr-only">Close modal</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

ModalContent.displayName = DialogPrimitive.Content.displayName;

export function ModalHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-2 text-left", className)} {...props} />;
}

export function ModalFooter({ className, ...props }) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export const ModalTitle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-foreground dark:text-foreground-dark text-lg font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
});

ModalTitle.displayName = DialogPrimitive.Title.displayName;

export const ModalDescription = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        "text-muted-foreground dark:text-muted-foreground-dark text-sm leading-relaxed",
        className
      )}
      {...props}
    />
  );
});

ModalDescription.displayName = DialogPrimitive.Description.displayName;
