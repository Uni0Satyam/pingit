import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
export const metadata: Metadata = {
  title: "Support Ease",
  description: "Get customer support chatbot in one click",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
      <Toaster />
    </html>
  );
}
