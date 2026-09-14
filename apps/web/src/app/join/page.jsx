import { Suspense } from "react";

import { JoinInviteClient } from "./JoinInviteClient";

export const metadata = {
  title: "Join FlexFlow",
};

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinShell title="Loading invitation..." />}>
      <JoinInviteClient />
    </Suspense>
  );
}

function JoinShell({ title }) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark w-full max-w-md rounded-3xl border p-8 text-center shadow-md">
        <div className="bg-brand-600 mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white">
          FF
        </div>
        <h1 className="text-foreground dark:text-foreground-dark text-xl font-semibold">{title}</h1>
      </div>
    </main>
  );
}
