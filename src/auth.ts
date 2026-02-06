import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = [
        "ventas1productoselrey@gmail.com",
        "ventas2productoselrey@gmail.com",
        "ventas3productoselrey@gmail.com",
        "ventasmztproductoselrey.com@gmail.com",
        "franzcharbell@gmail.com",
        "cesar.reyes.ochoa@gmail.com",
        "arturo.elreychiltepin@gmail.com",
        "ventasmochisproductoselrey@gmail.com",
        "alopezelrey@gmail.com",
        "promotoriaelrey@gmail.com",
        "ventas4productoselrey@gmail.com",
        "bodegaelrey034@gmail.com",
        "jesus.chiltepinelrey@gmail.com",
        process.env.OVERRIDE_EMAIL,
      ].filter(Boolean);

      return allowedEmails.includes(user.email?.toLowerCase() || "");
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async session({ session, token }) {
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
});
