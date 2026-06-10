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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
          FF
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      </div>
    </main>
  );
}
