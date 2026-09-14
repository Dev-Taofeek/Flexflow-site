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
    default: "FlexFlow — Project Management for Modern Teams",
    template: "%s | FlexFlow",
  },
  description:
    "Plan projects, track tasks, manage permissions, and capture team decisions in one real-time workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
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
  themeColor: "#0c0c0e",
};

// Applied before paint so the correct theme/font-size/language/RTL-preferences
// never flash (FOUC). Mirrors PreferencesContext so preferences persist.
const preferencesScript = `
(function () {
  function systemDark() {
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return true; }
  }
  var DARK_ONLY = ["dim", "ocean", "midnight", "high-contrast"];
  var THEMES = ["system", "light", "dark", "dim", "ocean", "midnight", "high-contrast"];
  var SCALES = ["sm", "base", "lg", "xl"];
  var LANGS = ["en", "fr", "es", "pt", "de", "ar", "zh", "ja"];
  var FOCUS = ["normal", "high"];
  try {
    var prefs = JSON.parse(localStorage.getItem("flexflow:preferences") || "{}");
    var theme = THEMES.indexOf(prefs.theme) !== -1 ? prefs.theme : "system";
    var fontScale = SCALES.indexOf(prefs.fontScale) !== -1 ? prefs.fontScale : "base";
    var lang = LANGS.indexOf(prefs.language) !== -1 ? prefs.language : "en";
    var focus = FOCUS.indexOf(prefs.focusVisibility) !== -1 ? prefs.focusVisibility : "normal";
    var dark = DARK_ONLY.indexOf(theme) !== -1 || theme === "dark" || (theme === "system" && systemDark());
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-font-size", fontScale);
    root.setAttribute("data-focus-visible", focus);
    root.setAttribute("data-reduced-motion", prefs.reducedMotion ? "true" : "false");
    root.setAttribute("data-high-contrast", prefs.highContrast ? "true" : "false");
    root.setAttribute("data-text-spacing", prefs.textSpacing ? "true" : "false");
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    var darkDefault = systemDark();
    var r = document.documentElement;
    r.classList.toggle("dark", darkDefault);
    r.setAttribute("data-theme", "system");
    r.setAttribute("data-font-size", "base");
    r.setAttribute("data-focus-visible", "normal");
    r.setAttribute("data-reduced-motion", "false");
    r.setAttribute("data-high-contrast", "false");
    r.setAttribute("data-text-spacing", "false");
    r.setAttribute("lang", "en");
    r.setAttribute("dir", "ltr");
    r.style.colorScheme = darkDefault ? "dark" : "light";
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="dark"
      data-theme="system"
      data-font-size="base"
      data-focus-visible="normal"
      data-reduced-motion="false"
      data-high-contrast="false"
      data-text-spacing="false"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencesScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}