# Git Workflow

## Branch 命名

```
feature/<feature-name>
fix/<bug-name>
docs/<doc-name>
chore/<task-name>
refactor/<scope>
```

`main` 為主線。個人專案可直接在 feature branch 開發後合回 `main`。

## Commit

遵守 Conventional Commits — 見 [`commit-convention.md`](commit-convention.md)。

## 基本流程

```bash
git status
git add .
git commit -m "feat: ..."
git push origin main   # remote 已設定為 GitHub alvis9315/knowledge-inbox
```

## Push 前檢查

- `git status` 確認 **沒有** `.env` / API key / entries 資料被納入
- `pnpm --filter web build` 通過
- 只有一份 lock file(`pnpm-lock.yaml`)

## Release / deploy

- 前端(`apps/web`):之後可接 Vercel(build `pnpm --filter web build`,output `apps/web/dist`)。
- Edge Function:`supabase functions deploy ingest`。
