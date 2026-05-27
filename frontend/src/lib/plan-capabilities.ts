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

// Billing is currently DISABLED: every user gets full, unlimited capabilities
// regardless of planId. To restore tiered plans, reinstate the per-plan logic
// here (and the limit checks in the API routes / crons that were relaxed).
export function getPlanCapabilities(_planId?: string | null): PlanCapabilities {
  return {
    allowedExportFormats: ["pdf", "docx", "json", "csv"],
    canUseBranding: true,
    showWatermark: false,
    unlimitedAudits: true,
    maxSites: Number.MAX_SAFE_INTEGER,
    autoIndexEnabled: true,
    emailReportFreq: "daily",
  };
}
