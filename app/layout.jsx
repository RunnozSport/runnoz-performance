import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Runnoz Performance Tracker',
  description: 'Track lift, jump, and sprint performance with AI-powered movement analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
