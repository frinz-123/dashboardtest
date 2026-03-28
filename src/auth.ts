import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  authEnv,
  getFirstAuthEnv,
  parseAuthEmailList,
} from "@/server/authEnv";

const authUrlCandidates = [
  { name: "AUTH_URL", value: authEnv.AUTH_URL },
  { name: "NEXTAUTH_URL", value: authEnv.NEXTAUTH_URL },
  { name: "URL", value: process.env.URL },
  { name: "DEPLOY_PRIME_URL", value: process.env.DEPLOY_PRIME_URL },
  { name: "DEPLOY_URL", value: process.env.DEPLOY_URL },
] as const;

const googleClientId = getFirstAuthEnv(
  "GOOGLE_CLIENT_ID",
  "AUTH_GOOGLE_ID",
);
const googleClientSecret = getFirstAuthEnv(
  "GOOGLE_CLIENT_SECRET",
  "AUTH_GOOGLE_SECRET",
);
const authSecret = getFirstAuthEnv(
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
);
const authUrlEntry = authUrlCandidates.find(
  ({ value }) => value && value.trim().length > 0,
);
const authUrl = authUrlEntry?.value?.trim();
const authUrlSource = authUrlEntry?.name ?? null;
const overrideEmails = parseAuthEmailList(authEnv.OVERRIDE_EMAIL);

let authUrlOrigin: string | null = null;

if (authUrl) {
  try {
    authUrlOrigin = new URL(authUrl).origin;
  } catch {
    console.error("[auth] Invalid auth URL environment variable", {
      authUrlSource,
    });
  }
}

const shouldTrustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  Boolean(
    authUrlOrigin ||
      process.env.NETLIFY ||
      process.env.VERCEL ||
      process.env.CF_PAGES,
  ) ||
  process.env.NODE_ENV !== "production";

const missingAuthConfig: string[] = [];

if (!googleClientId) {
  missingAuthConfig.push("GOOGLE_CLIENT_ID/AUTH_GOOGLE_ID");
}

if (!googleClientSecret) {
  missingAuthConfig.push("GOOGLE_CLIENT_SECRET/AUTH_GOOGLE_SECRET");
}

if (!authSecret) {
  missingAuthConfig.push("AUTH_SECRET/NEXTAUTH_SECRET");
}

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
    hasAuthUrl: Boolean(authEnv.AUTH_URL),
    hasNextAuthUrl: Boolean(authEnv.NEXTAUTH_URL),
    hasNetlifyUrl: Boolean(process.env.URL),
    hasDeployPrimeUrl: Boolean(process.env.DEPLOY_PRIME_URL),
    hasDeployUrl: Boolean(process.env.DEPLOY_URL),
    hasAuthTrustHost: Boolean(authEnv.AUTH_TRUST_HOST),
    hasNetlifyFlag: Boolean(process.env.NETLIFY),
    authUrlSource,
    authUrlOrigin,
    hasGoogleClientId: Boolean(googleClientId),
    hasGoogleClientSecret: Boolean(googleClientSecret),
    hasAuthSecret: Boolean(authSecret),
    trustHost: shouldTrustHost,
    missingAuthConfig,
  });
}

if (process.env.NODE_ENV === "production" && missingAuthConfig.length > 0) {
  throw new Error(
    `[auth] Invalid production auth configuration. Missing: ${missingAuthConfig.join(", ")}`,
  );
}

const providers =
  googleClientId && googleClientSecret
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : [];

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
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
        "chiltepinelreyhmo@gmail.com",
        "bodegaelrey034@gmail.com",
        "jesus.chiltepinelrey@gmail.com",
        ...overrideEmails,
      ];

      return allowedEmails.includes(user.email?.toLowerCase() || "");
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        if (new URL(url).origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {
        return baseUrl;
      }

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
