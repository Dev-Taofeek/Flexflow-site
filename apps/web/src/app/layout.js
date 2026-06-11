import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata = {
    title: {
        default: "FlexFlow — Project Management",
        template: "%s | FlexFlow",
    },
    description: "Manage projects, track issues, and collaborate with your team.",
    metadataBase: new URL("https://flexflow.app"),
    manifest: "/manifest.webmanifest",
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
};

export const viewport = {
    themeColor: "#6366f1",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
