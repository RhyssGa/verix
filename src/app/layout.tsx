import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Audit Comptable — Century 21',
  description: "Outil d'audit comptable pour la gérance et la copropriété",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
