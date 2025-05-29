
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Removed old sidebar imports:
// import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
// import { AppSidebarNav, MobileHeader } from "@/app/(components)/sidebar-nav";
import { AppDesktopSidebar, AppMobileHeaderWithSheet } from "@/app/(components)/app-navigation"; // New sidebar components
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PC Builder LMS",
  description: "Learn to build PCs with structured paths, lessons, and an AI assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <AppDesktopSidebar /> {/* New Desktop Sidebar */}
          <div className="flex flex-1 flex-col md:ml-64"> {/* Adjust margin for desktop sidebar */}
            <AppMobileHeaderWithSheet /> {/* New Mobile Header with Sheet */}
            <main className="flex-1 p-4 md:p-6"> {/* Adjusted padding */}
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
