/**
 * 本機檔案儲存(IndexedDB):存使用者上傳的大型檔案(登入頁自訂封面
 * 圖/影片)。localStorage 放不下(~5MB),IndexedDB 可到數十 MB。
 * 僅存於此瀏覽器;跨裝置同步屬未來 Supabase Storage 升級項。
 */
const DB_NAME = 'ki-files'
const STORE = 'files'

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const tx = async (mode: IDBTransactionMode) => {
  const db = await openDb()
  return db.transaction(STORE, mode).objectStore(STORE)
}

export const saveFile = async (key: string, file: Blob): Promise<void> => {
  const store = await tx('readwrite')
  await new Promise<void>((resolve, reject) => {
    const req = store.put(file, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export const loadFile = async (key: string): Promise<Blob | null> => {
  try {
    const store = await tx('readonly')
    return await new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export const removeFile = async (key: string): Promise<void> => {
  const store = await tx('readwrite')
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** 登入頁自訂封面的固定 key。 */
export const LOGIN_COVER_KEY = 'login-cover'
