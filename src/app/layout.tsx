import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Theile Riordan — Implementation Manager, Inteum",
    template: "%s · Theile",
  },
  description:
    "Theile Riordan — Implementation Manager at Inteum Company. Projects including Dictabird and RaveFAM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
