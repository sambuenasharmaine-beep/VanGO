export function peso(value: number | string) {
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export function dateOnly(value: string) {
  return new Date(value).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Hindi natuloy ang request. Subukan ulit.";
}

export function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
