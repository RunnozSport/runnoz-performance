const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Ensures Service Worker is compiled into public/sw.js
})

module.exports = withPWA({
  reactStrictMode: true,
})