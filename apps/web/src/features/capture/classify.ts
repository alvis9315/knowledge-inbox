import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { ruleClassify } from './ruleClassifier'

export interface Classification {
  type: string | null
  confidence: number
  reason?: string | null
}

/**
 * Guess a category for freeform text / a pasted URL.
 *
 * v2:規則分類器(網域對照表 + 關鍵字加權 + 回饋自學)—— 純前端、零 AI
 * 成本,mock 與 supabase 模式共用(docs/ai-strategy.md)。之後接本地
 * Ollama 或雲端 LLM 時,同樣的回傳形狀、呼叫端不動。
 */
export const classifyText = async (text: string): Promise<Classification> => {
  const store = useCategoriesStore()
  return ruleClassify(text, store.categories)
}
