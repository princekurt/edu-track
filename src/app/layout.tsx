import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EduTrack — EduKar Monitoring",
    template: "%s · EduTrack",
  },
  description:
    "Compliance management and disbursement monitoring system for the EduKar Scholarship Program of General Santos City.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
