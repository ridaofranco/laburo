import type { Metadata, Viewport } from "next";
import { Inter, Baloo_2 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
});

// Baloo 2 700 se usa SOLO para el lockup de marca "LABURO" (logo, no tipografía de UI).
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "LABURO",
  description: "Encontrá y contratá staff para tus eventos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0F1F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${baloo.variable} font-sans antialiased bg-surface-0 text-fg`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
          {children}
          <Toaster theme="dark" position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
