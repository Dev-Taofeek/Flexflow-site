"use client";

import { useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui";

export function ProfileSettingsClient() {
  const avatarInputRef = useRef(null);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [displayName, setDisplayName] = useState("Obayomi Taofeek");
  const [bio, setBio] = useState(
    "Frontend developer building FlexFlow as a recruiter-ready SaaS portfolio project."
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const activeSessions = [
    {
      id: "session-1",
      device: "Windows · Chrome",
      location: "Lagos, Nigeria",
      lastActive: "Current session",
      icon: "laptop",
    },
    {
      id: "session-2",
      device: "iPhone · Safari",
      location: "Lagos, Nigeria",
      lastActive: "2 hours ago",
      icon: "smartphone",
    },
  ];

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleProfileSave(event) {
    event.preventDefault();
  }

  function handlePasswordChange(event) {
    event.preventDefault();
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <div className="space-y-6">
      {/* ── Profile ── */}
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex flex-col items-center rounded-2xl border p-5">
            <Avatar src={avatarPreview} fallback="OT" size="xl" />

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => avatarInputRef.current?.click()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload avatar
            </Button>
          </div>

          <form onSubmit={handleProfileSave} className="flex-1 space-y-5">
            <div>
              <label
                htmlFor="displayName"
                className="text-foreground dark:text-foreground-dark text-sm font-medium"
              >
                Display name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <label
                htmlFor="bio"
                className="text-foreground dark:text-foreground-dark text-sm font-medium"
              >
                Bio
              </label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Change password ── */}
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div>
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Change password
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
              Update your account password securely.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="mt-6 grid gap-4 lg:grid-cols-2">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
          />
          <div className="lg:col-span-2">
            <Button type="submit">Update password</Button>
          </div>
        </form>
      </section>

      {/* ── Connected accounts ── */}
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          Connected accounts
        </h2>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* GitHub */}
          <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex items-center justify-between rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-foreground dark:text-foreground-dark"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <div>
                <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  GitHub
                </p>
                <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                  Not connected
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              Connect
            </Button>
          </div>

          {/* Google */}
          <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex items-center justify-between rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <div>
                <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  Google
                </p>
                <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                  Connected
                </p>
              </div>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        </div>
      </section>

      {/* ── Two-factor authentication ── */}
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-500"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>

          <div>
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Two-factor authentication
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
              Scan the TOTP QR placeholder with an authenticator app.
            </p>
          </div>
        </div>

        <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-6 flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center">
          <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground dark:text-muted-foreground-dark"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="18" y="14" width="3" height="3" />
              <rect x="14" y="18" width="3" height="3" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
          </div>

          <div>
            <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
              TOTP setup code
            </p>
            <code className="border-border bg-muted text-muted-foreground dark:border-border-dark dark:bg-muted-dark dark:text-muted-foreground-dark mt-2 block rounded-lg border px-3 py-2 text-xs">
              FLEX-FLOW-DEMO-TOTP-SECRET
            </code>
            <Button className="mt-4">Enable 2FA</Button>
          </div>
        </div>
      </section>

      {/* ── Active sessions ── */}
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          Active sessions
        </h2>

        <div className="mt-6 space-y-3">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="bg-muted text-muted-foreground dark:bg-muted-dark dark:text-muted-foreground-dark flex h-10 w-10 items-center justify-center rounded-xl">
                  {session.icon === "laptop" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="2" y1="20" x2="22" y2="20" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  )}
                </div>

                <div>
                  <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                    {session.device}
                  </p>
                  <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                    {session.location} · {session.lastActive}
                  </p>
                </div>
              </div>

              <Button variant="secondary" size="sm">
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
