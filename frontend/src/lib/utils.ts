import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function shortAddr(addr: string|undefined) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

export function formatNumber(x: number) {
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Combines class names using clsx and merges Tailwind classes properly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}