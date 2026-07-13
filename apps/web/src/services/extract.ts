import { isMock } from './dataMode'
import { supabase } from './supabaseClient'

export interface Extracted {
  title: string | null
  description: string | null
  finalUrl: string | null
}

/**
 * URL metadata 擷取(og/oEmbed/Maps 店名)——走 extract Edge Function
 * (瀏覽器 CORS 抓不到別人網頁)。Fail-soft:mock 模式或擷取失敗一律
 * 回 null,呼叫端照原樣存(擷取是加值,不是前提)。
 */
export const extractUrl = async (url: string): Promise<Extracted | null> => {
  if (isMock() || !supabase) return null
  try {
    const { data, error } = await supabase.functions.invoke('extract', { body: { url } })
    if (error || !data || data.error) return null
    return { title: data.title ?? null, description: data.description ?? null, finalUrl: data.finalUrl ?? null }
  } catch {
    return null
  }
}
