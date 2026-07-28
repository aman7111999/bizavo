import { redirect } from "next/navigation";
import { z } from "zod";

export function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || undefined;
}

export function numberValue(formData: FormData, key: string) {
  return Number(text(formData, key));
}

export function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export function ok(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`);
}

export function parseOrFail<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    fail(path, parsed.error.issues[0]?.message ?? "Please check the form and try again.");
  }
  return parsed.data;
}
