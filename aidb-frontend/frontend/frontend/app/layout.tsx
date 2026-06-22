import React from "react"
import type { Metadata, Viewport } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "@/components/ui/toaster"
import { I18nProvider } from "@/lib/i18n-context"
import './globals.css'

// Modern and crisp UI fonts optimized for glowing, soft interfaces
const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: 'AIDB: AI Assisted Database Manager',
  description: 'AI-powered data analytics platform with natural language SQL generation',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr">
      <body 
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased text-foreground bg-background selection:bg-primary/20`}
      >
        <I18nProvider>
          {children}
          <Toaster />
          <Analytics />
        </I18nProvider>
      </body>
    </html>
  )
}