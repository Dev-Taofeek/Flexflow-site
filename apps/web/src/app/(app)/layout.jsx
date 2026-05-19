import { AppShell } from "@/components/layout/AppShell";

export default function ProtectedAppLayout({ children }) {
    return <AppShell>{children}</AppShell>;
}
