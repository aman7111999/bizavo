import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Bizavo — One connected system for every business",
    template: "%s · Bizavo"
  },
  description: "Run customers, projects, people, inventory, payroll, finance and documents from one connected business platform.",
  metadataBase: new URL("https://bizavo.vercel.app")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
