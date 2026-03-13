// CHANGED IN STEP 9: Added ToastProvider, preconnect links, and preload font settings
import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/shared/Providers";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { ToastProvider } from "@/components/shared/Toast";
import ServiceWorkerRegister from "@/components/shared/ServiceWorkerRegister";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlyHome AI — Get home faster",
  description:
    "Real-time flight monitoring and instant rebooking for passengers stranded at Gulf-region airports during geopolitical disruptions.",
  openGraph: {
    title: "FlyHome AI — Get home faster",
    description:
      "Real-time flight monitoring and instant rebooking for passengers stranded at Gulf-region airports.",
    siteName: "FlyHome AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://api.duffel.com" />
        <link rel="preconnect" href="https://links.duffel.com" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://api.resend.com" />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <ToastProvider>
            <ServiceWorkerRegister />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
