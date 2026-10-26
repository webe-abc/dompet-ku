import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "DompetKu - Catatan Keuangan",
  description: "Aplikasi pencatat pengeluaran uang bulanan",
  manifest: "/manifest.json",
  icons: {
    icon: "/logojajan.png",
    apple: "/logojajan.png",
  },
  openGraph: {
    title: "DompetKu - Catatan Keuangan",
    description: "Aplikasi pencatat pengeluaran uang bulanan",
    images: [
      {
        url: "/logojajan.png",
        width: 512,
        height: 512,
        alt: "Logo DompetKu",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}