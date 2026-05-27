import type { useTranslations } from "next-intl";

type T = ReturnType<typeof useTranslations<"indexing">>;

export function gscStatusColor(
  status: string | null | undefined,
  t?: T,
): { bg: string; text: string; label: string } {
  const l = (key: string, fallback: string) => (t ? t(key as Parameters<NonNullable<T>>[0]) : fallback);
  if (!status) return { bg: "bg-gray-900", text: "text-gray-400", label: l("statusUnknown", "Unknown") };
  const s = status.toLowerCase();
  if (s.includes("submitted and indexed") || s === "indexed")
    return { bg: "bg-green-900/35", text: "text-green-400", label: l("statusIndexed", "Indexed") };
  if (s.includes("crawled") && s.includes("not indexed"))
    return {
      bg: "bg-orange-900/35",
      text: "text-orange-400",
      label: l("statusNotIndexed", "Not indexed"),
    };
  if (s.includes("discovered"))
    return {
      bg: "bg-yellow-900/35",
      text: "text-yellow-400",
      label: l("statusDiscovered", "Discovered"),
    };
  if (
    s.includes("blocked") ||
    s.includes("not found") ||
    s.includes("soft 404") ||
    s.includes("server error") ||
    s.includes("noindex")
  )
    return { bg: "bg-red-900/35", text: "text-red-400", label: l("statusBlocked", "Blocked") };
  if (s.includes("redirect") || s.includes("duplicate"))
    return {
      bg: "bg-yellow-900/35",
      text: "text-yellow-400",
      label: l("statusRedirect", "Redirect"),
    };
  return { bg: "bg-gray-900", text: "text-gray-400", label: l("statusUnknown", "Unknown") };
}

export function ourStatusColor(
  status: string,
  t?: T,
): { bg: string; text: string; label: string } {
  const l = (key: string, fallback: string) => (t ? t(key as Parameters<NonNullable<T>>[0]) : fallback);
  switch (status) {
    case "submitted":
      return {
        bg: "bg-copper/35",
        text: "text-copper-light",
        label: l("submitted", "Submitted"),
      };
    case "failed":
      return { bg: "bg-red-900/35", text: "text-red-400", label: l("failed", "Failed") };
    case "pending":
      return {
        bg: "bg-yellow-900/35",
        text: "text-yellow-400",
        label: l("pending", "Pending"),
      };
    case "removal_requested":
      return {
        bg: "bg-orange-900/35",
        text: "text-orange-400",
        label: l("statusRemovalSent", "Removal sent"),
      };
    default:
      return {
        bg: "bg-gray-900",
        text: "text-gray-500",
        label: l("notSubmitted", "Not submitted"),
      };
  }
}

export function getTip(gscStatus: string | null, t: T): string {
  if (!gscStatus) return t("tipStatusUnknown");
  const tips: Record<string, string> = {
    "Crawled - currently not indexed": t("tipCrawledNotIndexed"),
    "Discovered - currently not indexed": t("tipDiscoveredNotIndexed"),
    "URL is unknown to Google": t("tipUnknownToGoogle"),
    "Blocked by robots.txt": t("tipBlockedRobots"),
    "Blocked due to noindex": t("tipBlockedNoindex"),
    "Soft 404": t("tipSoft404"),
    "Not found (404)": t("tipNotFound404"),
    "Submitted and indexed": t("tipIndexed"),
    Indexed: t("tipIndexed"),
  };
  return tips[gscStatus] ?? t("tipDefault", { status: gscStatus });
}

export function logActionColor(action: string): { dot: string; text: string } {
  switch (action) {
    case "submitted_google":
      return { dot: "bg-green-400", text: "text-green-400" };
    case "submitted_indexnow":
      return { dot: "bg-copper-light", text: "text-copper-light" };
    case "failed":
      return { dot: "bg-red-400", text: "text-red-400" };
    case "url_discovered":
      return { dot: "bg-blue-400", text: "text-blue-400" };
    case "url_removed":
      return { dot: "bg-orange-400", text: "text-orange-400" };
    case "url_404":
      return { dot: "bg-red-500", text: "text-red-500" };
    case "removal_requested":
      return { dot: "bg-orange-400", text: "text-orange-400" };
    default:
      return { dot: "bg-gray-400", text: "text-gray-400" };
  }
}
