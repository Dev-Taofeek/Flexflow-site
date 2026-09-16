import { AppShell } from "@/components/layout/AppShell";

export const metadata = {
    robots: { index: false, follow: false },
};

export default function ProtectedAppLayout({ children }) {
    return <AppShell>{children}</AppShell>;
}
