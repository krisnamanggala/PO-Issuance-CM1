# TPEC CM1 PO Monitoring

Vercel-ready Next.js application backed by Supabase Auth and Postgres.

## Required configuration

1. Create or select a Supabase project and run `supabase/migrations/20260718000000_create_po_monitoring.sql` through the Supabase SQL editor or migration workflow.
2. In Supabase Auth, enable Email (magic link) and set the production redirect URL to `https://<your-domain>/auth/callback`.
3. Add each permitted team member to `public.workspace_members` after they have signed in once:

   ```sql
   insert into public.workspace_members (user_id, email)
   select id, email from auth.users where lower(email) = lower('member@company.com');
   ```

   Only workspace members can read or write PO revisions; the table is protected by RLS.
4. In Vercel, set these environment variables for Development, Preview, and Production:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

Never expose a Supabase `service_role` key to the browser or this app.

## Local development

```bash
cp .env.example .env.local
pnpm dev
pnpm test
```

## Deploy

Import this repository in Vercel or run `vercel deploy --prod` after adding the environment variables. The application uses standard Next.js App Router conventions and needs no Cloudflare bindings.
