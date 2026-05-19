"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/Button";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.76-.07-1.49-.2-2.19H12v4.14h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.48Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.41 13.9A6.02 6.02 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.49l3.35-2.59Z"
      />
      <path
        fill="currentColor"
        d="M12 5.99c1.47 0 2.8.51 3.84 1.5l2.86-2.86C16.97 3.02 14.7 2 12 2a10 10 0 0 0-8.94 5.51l3.35 2.59C7.2 7.74 9.4 5.99 12 5.99Z"
      />
    </svg>
  );
}

export function OAuthButtons() {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}
