import type { Metadata } from "next";
import "./globals.css";
import { RunProvider } from "@/app/context/RunContext";

export const metadata: Metadata = {
  title: "NOC Agentic Platform",
  description: "Telecom Network Operations Center — AI-powered capacity planning",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <RunProvider>
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">
                NOC Agentic Platform
              </h1>
              <span className="text-sm text-gray-500">Capacity Planning &amp; Risk Analysis</span>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        </RunProvider>
      </body>
    </html>
  );
}
