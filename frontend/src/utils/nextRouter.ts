/** Next.js `router.query` dynamic segment → single string (first value if array). */
export function queryParamToString(value: string | string[] | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}
