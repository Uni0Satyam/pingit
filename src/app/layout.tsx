import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
export const metadata: Metadata = {
  title: "pingit - Personalized embeddable chatbots, so you don't have to create from scratch for your next project",
  icons: { icon: "/icon.svg" },
  description:
    "Meet pingit: a friendly AI support assistant that answers customer questions using your business knowledge.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
      <Toaster />
    </html>
  );
}
