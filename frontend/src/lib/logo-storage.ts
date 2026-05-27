import { existsSync } from "fs";
import { join, resolve } from "path";

const FILENAME_RE = /^[a-zA-Z0-9_.-]+$/;
const API_PREFIX = "/api/upload/logo/";
const PUBLIC_PREFIX = "/uploads/";

function isFrontendRoot(dir: string): boolean {
  return (
    (existsSync(join(dir, "next.config.js")) || existsSync(join(dir, "next.config.ts"))) &&
    existsSync(join(dir, "package.json")) &&
    existsSync(join(dir, "public"))
  );
}

export function getFrontendRootDir(): string {
  const envRoot = process.env.FRONTEND_ROOT?.trim();
  if (envRoot) {
    return resolve(envRoot);
  }

  const cwd = process.cwd();
  const normalizedCwd = cwd.replace(/\\/g, "/");
  if (normalizedCwd.endsWith("/.next/standalone")) {
    return resolve(cwd, "../..");
  }

  const candidates = [
    cwd,
    resolve(cwd, ".."),
    resolve(cwd, "../.."),
    resolve(cwd, "../../.."),
  ];

  for (const candidate of candidates) {
    if (isFrontendRoot(candidate)) {
      return candidate;
    }
  }

  if (isFrontendRoot(join(cwd, "frontend"))) {
    return join(cwd, "frontend");
  }

  return cwd;
}

export function getUploadsDir(): string {
  return join(getFrontendRootDir(), "public", "uploads");
}

export function extractLogoFilenameFromUrl(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;

  let pathname = logoUrl;
  try {
    pathname = new URL(logoUrl, "https://placeholder.local").pathname;
  } catch {
    return null;
  }

  let raw = "";
  if (pathname.startsWith(API_PREFIX)) {
    raw = pathname.slice(API_PREFIX.length);
  } else if (pathname.startsWith(PUBLIC_PREFIX)) {
    raw = pathname.slice(PUBLIC_PREFIX.length);
  } else {
    return null;
  }

  return FILENAME_RE.test(raw) ? raw : null;
}

export function toApiLogoPath(logoUrl?: string | null): string | null {
  const filename = extractLogoFilenameFromUrl(logoUrl);
  return filename ? `${API_PREFIX}${filename}` : null;
}

export function toPublicLogoPath(logoUrl?: string | null): string | null {
  const filename = extractLogoFilenameFromUrl(logoUrl);
  return filename ? `${PUBLIC_PREFIX}${filename}` : null;
}
