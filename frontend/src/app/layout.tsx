import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Deliverability Checker",
  description: "Live SPF, DKIM, DMARC, MX, and DNS diagnostics."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
