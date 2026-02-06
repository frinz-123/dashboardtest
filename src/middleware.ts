import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|auth/signin|auth/error|login|_next/static|_next/image|favicon.ico|icons|manifest.json|service-worker.js).*)",
  ],
};
