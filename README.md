This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Production auth configuration

Production auth depends on these server-side environment variables being present in the deploy target:

- `GOOGLE_CLIENT_ID` or `AUTH_GOOGLE_ID`
- `GOOGLE_CLIENT_SECRET` or `AUTH_GOOGLE_SECRET`
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `AUTH_URL` or `NEXTAUTH_URL` for the canonical production URL

On Netlify, `URL` and `DEPLOY_PRIME_URL` are also detected for runtime diagnostics, but they do not replace the need to set the OAuth credentials and auth secret explicitly.

This project uses `next.config.mjs` to inline auth-critical environment variables at build time for the server auth bundle. Keep that list limited to server-only auth keys, because Next.js will substitute those values into compiled JavaScript anywhere they are referenced.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
