# TPEC CM1 PO Monitoring

Vercel-ready Next.js application backed by Supabase Auth and Postgres.

## Required configuration

1. Create or select a Supabase project and run `supabase/migrations/20260718000000_create_po_monitoring.sql` through the Supabase SQL editor or migration workflow.
2. In Supabase Auth, enable Email and password authentication, keep **Confirm email** enabled, and set the production redirect URL to `https://<your-domain>/auth/callback`.
3. The migration automatically permits and enrolls only `@tripatra.com` accounts. Workspace data remains protected by RLS; no manual membership insert is required.
4. In **Authentication → Sessions**, set **Time-box user sessions** to **90 days** (this setting requires a Supabase Pro plan or above). Keep the JWT lifetime at its secure default of one hour. The app refreshes that short-lived token while the three-month session is active.
5. In Vercel, set these environment variables for Development, Preview, and Production:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

Never expose a Supabase `service_role` key to the browser or this app. Configure a custom SMTP provider before production because the default Supabase sender is rate-limited.

## Local development

```bash
cp .env.example .env.local
pnpm dev
pnpm test
```

## Deploy

Import this repository in Vercel or run `vercel deploy --prod` after adding the environment variables. The application uses standard Next.js App Router conventions and needs no Cloudflare bindings.
