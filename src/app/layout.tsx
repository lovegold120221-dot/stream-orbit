import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { CallProvider } from "@/context/CallContext";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import StarfieldBackground from "@/components/StarfieldBackground";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#11100f" },
  ],
};

export const metadata: Metadata = {
  title: "Orbit Meeting",
  description: "Real-time meeting translation with Eburon AI — speak any language, hear in yours.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orbit Meeting",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#11100f",
    "msapplication-TileImage": "/icons/mstile-150x150.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Orbit Meeting" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Orbit Meeting" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var preference = localStorage.getItem('orbit.theme') || 'system';
                if (preference !== 'system' && preference !== 'dark' && preference !== 'light') {
                  preference = 'system';
                }
                var resolved = preference === 'system'
                  ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
                  : preference;
                document.documentElement.dataset.theme = resolved;
                document.documentElement.dataset.themePreference = preference;
                document.documentElement.style.colorScheme = resolved;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <StarfieldBackground />
        <AuthProvider>
          <UserProvider>
            <CallProvider>{children}</CallProvider>
          </UserProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
