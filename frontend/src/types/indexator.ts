export interface GscStatus {
  connected: boolean;
  hasRequiredScopes: boolean;
  email: string | null;
  scopes: string[];
  connectedAt: string | null;
}

export interface Site {
  id: string;
  domain: string;
  gscPermissionLevel: string | null;
  autoIndexGoogle: boolean;
  autoIndexBing: boolean;
  sitemapUrl: string | null;
  indexnowKey: string | null;
  indexnowKeyVerified: boolean;
  lastSyncedAt: string | null;
  totalUrls: number;
  indexedCount: number;
  submissionCounts: Record<string, number>;
}

export interface SiteStats {
  total: number;
  indexed: number;
  notIndexed: number;
  pending: number;
  submittedGoogle: number;
  submittedBing: number;
  failed: number;
  is404s: number;
}

export interface Quota {
  googleSubmissions: { used: number; limit: number; remaining: number };
  inspections: { used: number; limit: number; remaining: number };
}

export interface UrlRecord {
  id: string;
  url: string;
  gscStatus: string | null;
  indexingStatus: string;
  submissionMethod: string;
  submittedAt: string | null;
  lastSyncedAt: string | null;
  lastInspectedAt: string | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

export interface UrlPage {
  urls: UrlRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Report {
  today: {
    newPagesDetected: number;
    newPagesList: string[];
    submittedGoogle: number;
    submittedBing: number;
    failed: number;
    pages404: number;
    pages404List: string[];
  };
  overall: {
    total: number;
    indexed: number;
    notIndexed: number;
    pending: number;
  };
  quota: {
    googleUsed: number;
    googleLimit: number;
    googleRemaining: number;
  };
}

export interface ConfirmState {
  siteId: string;
  urlIds: string[];
  engines: string[];
  count: number;
}

export interface RunStatus {
  phase: "running" | "done" | "error";
  newUrls?: number;
  changedUrls?: number;
  removedUrls?: number;
  submittedGoogle?: number;
  submittedBing?: number;
  failedGoogle?: number;
  failedBing?: number;
  errorMsg?: string;
  ranAt?: string;
}

export interface LastAutoIndexReport {
  reportDate: string;
  newPagesFound: number;
  changedPagesFound: number;
  removedPagesFound: number;
  submittedGoogle: number;
  submittedBing: number;
  submittedGoogleFailed: number;
  submittedBingFailed: number;
  pages404: number;
  totalIndexed: number;
  totalUrls: number;
  details: string | null;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  action: string;
  label: string;
  url: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface LogPage {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  availableActions: string[];
}
