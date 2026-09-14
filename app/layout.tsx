import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import InstallPrompt from "@/components/install-prompt";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "Orbit — A inteligência que conecta tudo",
  description:
    "Converse agora, sem cadastro. Em breve: todas as IAs, serviços e sua vida digital em um único lugar.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Orbit" },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-[#FAFAFA] font-sans text-zinc-900 antialiased dark:bg-[#09090B] dark:text-zinc-100">
        <ThemeProvider>
          {children}
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}