import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { AuthOptions } from "next-auth"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: "814854691379-gq7jtkbabk37v5434ao7b43m594gr9dv.apps.googleusercontent.com",
      clientSecret: "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",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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