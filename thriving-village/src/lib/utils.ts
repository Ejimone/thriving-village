import { clsx, type ClassValue } from "clsx";

/** Merge class names. Kept dependency-light; clsx is enough for this skin. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format a number as Naira. Pricing across the platform is in ₦. */
export function naira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}
