import { ui } from "@/i18n/ui";

/** "today", "yesterday", "3 days ago", then a date. */
export function timeAgo(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days < 1) return ui("today");
  if (days === 1) return ui("yesterday");
  if (days < 30) return `${days} ${ui("days ago")}`;
  return new Date(time).toLocaleDateString();
}

export const errorText = (error: unknown) => (error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "Something went wrong");
