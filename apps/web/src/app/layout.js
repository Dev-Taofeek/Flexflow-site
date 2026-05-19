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
