"use client";

/**
 * Server-component safe wrapper for live translation of static prose.
 * Renders the original text until a real-time translation arrives, without
 * forcing the surrounding page to become a client component.
 */
import { Translated } from "@/lib/translate";

export function LiveText({ children }) {
  return <Translated>{children}</Translated>;
}