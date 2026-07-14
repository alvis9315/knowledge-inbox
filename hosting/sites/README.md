# OpenAI Sites adapter

Knowledge Inbox remains a Vue 3 + Vite application. OpenAI Sites hosts the
compiled `apps/web/dist` assets behind a small request handler that:

1. injects public runtime configuration before the Vite module starts;
2. serves hashed assets as immutable files;
3. returns `index.html` for Vue Router history-mode routes.

The hosted environment uses these runtime values:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

They are public browser connection values. Never add
`SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the Sites frontend.

The deployment wrapper is generated and versioned by OpenAI Sites. This folder
documents the source contract so the Vue repository and hosted version stay in
sync.
