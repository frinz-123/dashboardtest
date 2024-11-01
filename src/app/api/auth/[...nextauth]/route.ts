import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { AuthOptions } from "next-auth"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, _account, _profile }) {
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

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }