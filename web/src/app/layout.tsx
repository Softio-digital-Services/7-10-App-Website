import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "7-10 Store",
  description: "Clothing store with synced web and mobile shopping",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-stone-50 text-stone-900 antialiased">
        <Providers>
          <CartProvider>
            <Header />
            {children}
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
