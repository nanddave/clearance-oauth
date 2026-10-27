import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clearance",
  description: "How hard is it to get your OAuth app approved?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><header className="border-b border-zinc-200 bg-white">
          <nav aria-label="Main" className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 text-sm">
            <Link href="/" className="text-base font-semibold tracking-tight text-zinc-950">Clearance</Link>
            <Link href="/corrections" className="underline-offset-2 hover:underline">Corrections</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
