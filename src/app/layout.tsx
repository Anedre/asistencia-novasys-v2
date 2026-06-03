import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PremiumIconDefs } from "@/components/nova/premium-icon";
import "./globals.css";
import "@/styles/nova-design.css";

// ── TYPOGRAPHY — Orbital Control ──
// Sora: all sans UI, headers, body. JetBrains Mono: numbers, clocks, amounts, IDs.
// Weights mirror the design handoff's font link exactly.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Novasys Asistencia",
    template: "%s | Novasys Asistencia",
  },
  description: "Sistema de control de asistencia de personal - Novasys",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <PremiumIconDefs />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
