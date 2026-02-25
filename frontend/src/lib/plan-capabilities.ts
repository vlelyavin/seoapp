// "html" is kept in the type for backwards-compatibility but is not offered in any plan
export type ExportFormat = "pdf" | "html" | "docx" | "json" | "csv";

export interface PlanCapabilities {
  // Audit caps
  allowedExportFormats: ExportFormat[];
  canUseBranding: boolean;
  showWatermark: boolean;
  unlimitedAudits: boolean;
  // Indexator caps
  maxSites: number;
  autoIndexEnabled: boolean;
  emailReportFreq: "none" | "weekly" | "daily";
}

export function getPlanCapabilities(planId?: string | null): PlanCapabilities {
  const isAgency = planId === "agency";
  const isPro = planId === "pro";
  const isFree = planId === "free";

  return {
    allowedExportFormats: isAgency
      ? ["pdf", "docx", "json", "csv"]  // html disabled; json/csv agency-only
      : isPro
      ? ["pdf", "docx"]                  // html disabled
      : ["pdf"],
    canUseBranding: isAgency,
    showWatermark: isFree,
    unlimitedAudits: isAgency || isPro,
    maxSites: isAgency ? 10 : isPro ? 5 : 1,
    autoIndexEnabled: isAgency || isPro,
    emailReportFreq: isAgency ? "daily" : isPro ? "weekly" : "none",
  };
}

