import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const font = Nunito({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Maylingo - Học 1000 từ vựng",
  description: "Ứng dụng học từ vựng tiếng Anh theo chủ đề với lặp lại ngắt quãng.",
  // Makes "Add to Home Screen" on iOS launch full-screen (standalone) with the mascot icon.
  appleWebApp: {
    capable: true,
    title: "Maylingo",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#22c55e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="vi">
        <body className={font.className}>
          {children}
          <Toaster richColors position="top-center" />
        </body>
      </html>
    </ClerkProvider>
  );
}
