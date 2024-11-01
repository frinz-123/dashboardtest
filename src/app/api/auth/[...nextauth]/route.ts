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
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account: _, profile: __ }) {
      const allowedEmails = [
        'ventas1productoselrey@gmail.com',
        'ventas2productoselrey@gmail.com',
        'ventas3productoselrey@gmail.com',
        'ventasmztproductoselrey.com@gmail.com',
        'franzcharbell@gmail.com',
        'cesar.reyes.ochoa@gmail.com',
        process.env.OVERRIDE_EMAIL
      ].filter(Boolean)
      
      return allowedEmails.includes(user.email?.toLowerCase() || '')
    },
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl
    },
    async session({ session, token }) {
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }