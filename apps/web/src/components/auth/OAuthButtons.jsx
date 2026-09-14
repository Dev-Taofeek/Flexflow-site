"use client";

import { signIn } from "next-auth/react";
import { useI18n } from "@/i18n";

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

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm6.312 6.312a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.146 15.165a2.528 2.528 0 0 1-2.522-2.52v-2.521h2.522zm0-1.271a2.528 2.528 0 0 1-2.522-2.521 2.528 2.528 0 0 1 2.522-2.521h6.312A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-6.312zm-6.312-6.312A2.528 2.528 0 0 1 15.146 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.271a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" />
    </svg>
  );
}

export function OAuthButtons({ callbackUrl = "/dashboard" }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl })}
      >
        <GoogleIcon />
        {t("auth.continueWithGoogle")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => signIn("github", { callbackUrl })}
      >
        <GitHubIcon />
        {t("auth.continueWithGitHub")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => signIn("slack", { callbackUrl })}
      >
        <SlackIcon />
        {t("auth.continueWithSlack")}
      </Button>
    </div>
  );
}