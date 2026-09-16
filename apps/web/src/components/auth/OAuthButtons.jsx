"use client";

import { signIn } from "next-auth/react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

function GoogleIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.76-.07-1.49-.2-2.19H12v4.14h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.48Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.9A6.02 6.02 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.49l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.8.51 3.84 1.5l2.86-2.86C16.97 3.02 14.7 2 12 2a10 10 0 0 0-8.94 5.51l3.35 2.59C7.2 7.74 9.4 5.99 12 5.99Z"
      />
    </svg>
  );
}

function GitHubIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function SlackIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm6.312 6.312a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.146 15.165a2.528 2.528 0 0 1-2.522-2.52v-2.521h2.522zm0-1.271a2.528 2.528 0 0 1-2.522-2.521 2.528 2.528 0 0 1 2.522-2.521h6.312A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-6.312zM8.834 2.522A2.528 2.528 0 0 1 11.355 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zM8.834 3.793a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 6.313 0a2.528 2.528 0 0 1 2.521 2.522v1.271z" />
    </svg>
  );
}

function FigmaIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zM12.735 14.164H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 13.293h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019H8.148v6.038zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148z"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", labelKey: "auth.continueWithGoogle", Icon: GoogleIcon },
  { id: "github", labelKey: "auth.continueWithGitHub", Icon: GitHubIcon },
  { id: "slack", labelKey: "auth.continueWithSlack", Icon: SlackIcon },
  { id: "figma", labelKey: "auth.continueWithFigma", Icon: FigmaIcon },
];

/**
 * One-line row of logo-only social sign-in buttons (Google, GitHub, Slack,
 * Figma). Full provider labels are exposed as tooltips / aria-labels.
 */
export function OAuthButtons({ callbackUrl = "/dashboard" }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {PROVIDERS.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          type="button"
          title={t(labelKey)}
          aria-label={t(labelKey)}
          onClick={() => signIn(id, { callbackUrl })}
          className={cn(
            "border-border bg-background text-muted-foreground hover:text-foreground dark:border-border-dark dark:bg-background-dark",
            "hover:bg-muted dark:hover:bg-muted-dark flex h-11 items-center justify-center rounded-xl border transition-all",
            "hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}