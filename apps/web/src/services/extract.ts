import { isMock } from './dataMode'
import { supabase } from './supabaseClient'

export interface Extracted {
  title: string | null
  description: string | null
  finalUrl: string | null
}

/** 前端等待上限:逾時就放棄該次擷取照原樣存,不卡「儲存中」(提案 H2)。 */
const EXTRACT_DEADLINE_MS = 3000

/**
 * URL metadata 擷取(og/oEmbed/Maps 店名)——走 extract Edge Function
 * (瀏覽器 CORS 抓不到別人網頁)。Fail-soft:mock 模式、擷取失敗或
 * 超過 3s 一律回 null,呼叫端照原樣存(擷取是加值,不是前提)。
 */
export const extractUrl = async (url: string): Promise<Extracted | null> => {
  if (isMock() || !supabase) return null
  try {
    const invoke = supabase.functions
      .invoke('extract', { body: { url } })
      .then(({ data, error }) => {
        if (error || !data || data.error) return null
        return {
          title: (data.title ?? null) as string | null,
          description: (data.description ?? null) as string | null,
          finalUrl: (data.finalUrl ?? null) as string | null,
        }
      })
    const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), EXTRACT_DEADLINE_MS))
    return await Promise.race([invoke, deadline])
  } catch {
    return null
  }
}
