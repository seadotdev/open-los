import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open LOS - AI-Native Loan Origination System",
  description:
    "Open source, headless B2B lending platform. Try the demo with CLI, REST API, or AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
