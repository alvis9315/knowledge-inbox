/** Special browse scopes reused where a real category key is expected. */
export const SCOPE_ALL = '__all__'
export const SCOPE_PENDING = '__pending__'

export const PAGE_SIZE = 30

export function isRealCategory(type: string): boolean {
  return type !== SCOPE_ALL && type !== SCOPE_PENDING
}
