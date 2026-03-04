import type { Metadata } from "next";
import "./globals.css";
import { SocketProvider } from "../context/SocketContext";

export const metadata: Metadata = {
  title: "Soul Broker Online | Город Душ",
  description: "Многопользовательская стратегия в реальном времени.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
