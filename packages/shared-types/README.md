# @inbox/shared-types

Shared TypeScript types generated from the Supabase DB schema. Any app in this
monorepo imports one source of truth: `import type { Entry } from '@inbox/shared-types'`.

## Regenerate from the live DB (do this after schema changes)

```bash
supabase gen types typescript --project-id <your-project-id> \
  > packages/shared-types/src/database.types.ts
```

Then keep `src/index.ts` re-exporting the friendly aliases used across apps.

> `src/database.types.ts` currently holds a **hand-written placeholder** that
> mirrors `supabase/migrations`. Replace it with the generated file once the
> Supabase project exists — the app code depends on the aliases in `index.ts`,
> not on the placeholder shape, so regeneration is a drop-in swap.
