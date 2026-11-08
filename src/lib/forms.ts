import { redirect } from "next/navigation";

export function redirectWith(
  path: string,
  params?: Record<string, string | undefined>,
): never {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  redirect(query ? `${path}?${query}` : path);
}

export function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStr(formData: FormData, key: string) {
  const value = str(formData, key);
  return value.length > 0 ? value : null;
}

export function num(formData: FormData, key: string) {
  const value = str(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bool(formData: FormData, key: string) {
  return str(formData, key) === "on" || str(formData, key) === "true";
}

export function messageFrom(error: { message?: string } | null | undefined) {
  return error?.message ?? "The operation could not be completed.";
}
