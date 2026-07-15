import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { ruleClassify } from './ruleClassifier'

export interface Classification {
  type: string | null
  confidence: number
  reason?: string | null
}

/** 網頁擷取結果(顯式契約,提案 H3):有值 = 啟用多主題平台軟化評分。 */
export interface ClassifyMeta {
  title: string
  description: string | null
}

/**
 * Guess a category for freeform text / a pasted URL.
 *
 * v2:規則分類器(網域對照表 + 關鍵字加權 + 回饋自學)—— 純前端、零 AI
 * 成本,mock 與 supabase 模式共用(docs/ai-strategy.md)。之後接本地
 * Ollama 或雲端 LLM 時,同樣的回傳形狀、呼叫端不動。
 * `meta` 由 extract 擷取結果而來;未傳 = 純 URL 行為與既往完全相同。
 */
export const classifyText = async (text: string, meta?: ClassifyMeta): Promise<Classification> => {
  const store = useCategoriesStore()
  return ruleClassify(text, store.categories, { hasMeta: !!meta })
}
