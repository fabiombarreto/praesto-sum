import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class composition for the owned component library (ADR-0011): clsx for conditionals, tailwind-merge to resolve conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
