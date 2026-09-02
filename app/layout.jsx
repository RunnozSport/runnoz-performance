export const metadata = {
  title: 'RUNNOZ VBT',
  description: 'Velocity Based Training',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469629/pose.min.js"></script>
        <script async src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.5.1675469629/drawing_utils.min.js"></script>
      </head>
      <body>{children}</body>
    </html>
  )
}