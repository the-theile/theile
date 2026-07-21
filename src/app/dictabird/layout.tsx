import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dictabird",
  description:
    "Dictabird: live meeting notes, mic transcription, enhanced summaries. No meeting bots.",
};

export default function DictabirdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      <AppShell>{children}</AppShell>
    </div>
  );
}
