import type { Metadata, Viewport } from "next";
import { Inter, Syne, Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

// Inter — cuerpo/UI (Radical Minimalist: neutral, legible en bloques densos).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

// Syne — headlines monumentales + wordmark "LABURO." (all-caps, tracking apretado).
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
});

// Geist — labels/técnico (uppercase, tracking amplio, "technical luxury").
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "LABURO.",
  description: "Encontrá y contratá staff para tus eventos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${syne.variable} ${geist.variable} font-sans antialiased bg-surface-0 text-fg`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
          {children}
          <Toaster theme="dark" position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
