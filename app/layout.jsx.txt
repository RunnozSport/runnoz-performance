import './globals.css'

export const metadata = {
  title: 'Runnoz Performance Tracker',
  description: 'Track lift, jump, and sprint performance',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}