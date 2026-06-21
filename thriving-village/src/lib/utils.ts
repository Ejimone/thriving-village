import { clsx, type ClassValue } from "clsx";

/** Merge class names. Kept dependency-light; clsx is enough for this skin. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format a number as Naira. Pricing across the platform is in ₦. */
export function naira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

/** Relative time for admin activity feeds, e.g. "2 hours ago". */
export function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
