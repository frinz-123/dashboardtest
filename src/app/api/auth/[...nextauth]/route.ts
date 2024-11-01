import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"

export const options: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account: _, profile: __ }) {
      const allowedEmails = [
        'ventas1productoselrey@gmail.com',
        'ventas2productoselrey@gmail.com',
        'ventas3productoselrey@gmail.com',
        'ventasmztproductoselrey.com@gmail.com',
        'franzcharbell@gmail.com',
        'cesar.reyes.ochoa@gmail.com',
        'arturo.elreychiltepin@gmail.com'
      ]
      
      return allowedEmails.includes(user.email?.toLowerCase() || '')
    }
  }
}

const handler = NextAuth(options)

export { handler as GET, handler as POST }