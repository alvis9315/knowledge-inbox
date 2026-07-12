# Commit Convention

Conventional Commits:

```
feat:     新增功能
fix:      修正錯誤
docs:     文件調整
style:    格式調整(不影響邏輯)
refactor: 重構
test:     測試
chore:    雜項
build:    建置相關
ci:       CI/CD 相關
```

格式:`<type>: <簡述>`,必要時加 scope,如 `feat(entries): 新增 schema-driven 表單`。

範例:

```
feat: scaffold monorepo, Phase 1 MVP and docs
feat(entries): 卡牆依領域 / 類型 / 標籤篩選
fix(rls): 修正 entry_tags policy 條件
docs: 補上 ingest pipeline 流程圖
```
