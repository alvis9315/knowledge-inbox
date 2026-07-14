# Deployment Guide

## Supported targets

- Local development: Vue 3 / Vite dev server.
- GitHub Pages: static Vite build, with the repository base path configured by
  the deployment workflow when needed.
- OpenAI Sites: private or shared hosted application with SPA route fallback
  and runtime Supabase configuration.

## Local development

```bash
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.development.local
pnpm dev
```

`apps/web/.env.development.local` must point to a separate development
Supabase project and contain:

```text
VITE_SUPABASE_ENV=development
VITE_SUPABASE_URL=https://<development-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The file is ignored by Git. The app refuses to start locally when Supabase is
configured without the explicit `development` label, reducing the chance of
running test writes against production.

### Supabase environment split

Use two independent Supabase projects:

| Runtime | Supabase project | Configuration source |
| --- | --- | --- |
| Local Vite | `knowledge-inbox-dev` | `apps/web/.env.development.local` |
| OpenAI Sites | `knowledge-inbox-prod` | Sites environment variables |

Apply every migration in `supabase/migrations` to both projects. Seed only
development-safe sample data into the development project; do not copy real
personal entries into it. Edge Function secrets are project-specific and must
be configured separately in each Supabase project.

## Production verification

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

The production client output is `apps/web/dist`.

## OpenAI Sites

The Sites project identity is stored in `.openai/hosting.json`. The hosting
adapter serves the Vite output, injects runtime configuration, and falls back
to `index.html` for Vue Router history-mode routes.

Configure these hosted values in the Site settings:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

These hosted values must point only to `knowledge-inbox-prod`. Do not reuse
the development project values here.

Do not configure either of these in the frontend Site:

```text
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

After the first deployment, add the exact production origin and its wildcard
path to Supabase Authentication > URL Configuration > Redirect URLs.

## Release checklist

1. Typecheck and build pass from a clean pnpm install.
2. No `.env`, service key, API key, personal entry, or exported dataset is
   tracked by Git.
3. `/login`, `/d/:domain`, `/c/:type`, and `/entries/:id` load directly and
   after refresh.
4. Guest mode stays in localStorage and never reads the owner's Supabase data.
5. Email and Google login return to the deployed origin.
6. RLS is verified before allowing additional authenticated users.
