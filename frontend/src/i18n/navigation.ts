import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

/**
 * Build a locale-aware path string for non-component contexts
 * (NextAuth callbacks, emails, etc.).
 * Omits the locale prefix for the default locale (en).
 */
export function localePath(locale: string, path: string): string {
  return `/${locale}${path}`;
}
