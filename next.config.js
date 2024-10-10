const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // Your existing Next.js config options here
  images: {
    domains: ['your-domain.com'], // Add any domains you're loading images from
  },
  // Remove the 'target' property as it's no longer needed
})