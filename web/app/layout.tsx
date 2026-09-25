import type { Metadata, Viewport } from "next";
import "./globals.css";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Kisan Sathi";

export const metadata: Metadata = {
  title: `${brand} · AI Agri Assistant`,
  description: "Talk or chat in any Indian language: crop advice, live stock, prices and orders.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e120d" },
  ],
};

// Apply the saved or system theme before first paint (no flash).
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
