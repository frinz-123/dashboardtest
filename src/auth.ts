import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

const shouldTrustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  Boolean(
    process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.NETLIFY ||
      process.env.VERCEL ||
      process.env.CF_PAGES,
  ) ||
  process.env.NODE_ENV !== "production";

if (!googleClientId || !googleClientSecret) {
  console.error("[auth] Missing Google OAuth environment variables", {
    hasGoogleClientId: Boolean(googleClientId),
    hasGoogleClientSecret: Boolean(googleClientSecret),
    expectedVars: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
    ],
  });
}

if (!authSecret) {
  console.error("[auth] Missing auth secret environment variable", {
    expectedVars: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
  });
}

if (process.env.NODE_ENV === "production") {
  console.log("[auth] Runtime configuration snapshot", {
    hasAuthUrl: Boolean(process.env.AUTH_URL),
    hasNextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
    hasAuthTrustHost: Boolean(process.env.AUTH_TRUST_HOST),
    hasNetlifyFlag: Boolean(process.env.NETLIFY),
    trustHost: shouldTrustHost,
  });
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId ?? "",
      clientSecret: googleClientSecret ?? "",
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
    async session({ session }) {
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  trustHost: shouldTrustHost,
  secret: authSecret,
  logger: {
    error(code, metadata) {
      console.error("[auth][error]", code, metadata);
    },
    warn(code) {
      console.warn("[auth][warn]", code);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth][debug]", code, metadata);
      }
    },
  },
  session: {
    strategy: "jwt",
  },
});
