import type { Metadata } from "next";
import { AppDataProvider } from "@/components/providers/AppDataProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Bracket Challenge",
  description: "Build and score World Cup entries with group-stage and knockout picks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppDataProvider>{children}</AppDataProvider>
      </body>
    </html>
  );
}
