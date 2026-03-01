"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExportFormat } from "@/lib/plan-capabilities";

export interface ExportOptions {
  includeCompanyName: boolean;
  includeCompanyLogo: boolean;
  showPagesCrawled: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: string, lang: string, options: ExportOptions) => void;
  loading?: boolean;
  defaultLang?: string;
  formatOptions?: ExportFormat[];
  hasCompanyLogo?: boolean;
  hasCompanyName?: boolean;
}

const ALL_FORMAT_OPTIONS: Record<ExportFormat, string> = {
  pdf: "PDF",
  html: "HTML", // Not offered in any plan — kept for potential future re-enabling
  docx: "DOCX",
  json: "JSON",
  csv: "CSV",
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "ru", label: "Русский" },
];

export function ExportDialog({
  open,
  onClose,
  onExport,
  loading = false,
  defaultLang = "en",
  formatOptions,
  hasCompanyLogo = false,
  hasCompanyName = false,
}: ExportDialogProps) {
  const t = useTranslations("audit");
  const resolvedFormatOptions =
    formatOptions && formatOptions.length > 0 ? formatOptions : (["pdf", "html", "docx"] as ExportFormat[]);
  const [format, setFormat] = useState<ExportFormat>(() => resolvedFormatOptions[0]);
  const [lang, setLang] = useState(defaultLang);
  const [showPagesCrawled, setShowPagesCrawled] = useState(false);
  const [includeCompanyName, setIncludeCompanyName] = useState(hasCompanyName);
  const [includeCompanyLogo, setIncludeCompanyLogo] = useState(false);
  const selectedFormat = resolvedFormatOptions.includes(format)
    ? format
    : resolvedFormatOptions[0];

  const isDocumentFormat = selectedFormat !== "json" && selectedFormat !== "csv";

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 mx-5 w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-copper/10">
          <Download className="h-6 w-6 text-copper" />
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-semibold text-white">
          {t("exportDialogTitle")}
        </h3>

        {/* Message */}
        <p className="mb-5 text-sm text-gray-400">
          {t("exportDialogMessage")}
        </p>

        {/* Format select */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-300">
            {t("exportFormat")}
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            disabled={loading}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-base md:text-sm text-white outline-none transition-colors focus:border-copper focus:ring-2 focus:ring-copper/20 disabled:opacity-50"
          >
            {resolvedFormatOptions.map((opt) => (
              <option key={opt} value={opt}>
                {ALL_FORMAT_OPTIONS[opt]}
              </option>
            ))}
          </select>
        </div>

        {/* Language select — not shown for data formats (JSON/CSV) */}
        {isDocumentFormat && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              {t("exportLanguage")}
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-base md:text-sm text-white outline-none transition-colors focus:border-copper focus:ring-2 focus:ring-copper/20 disabled:opacity-50"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggles — only for document formats (PDF/DOCX/HTML) */}
        {isDocumentFormat && (
          <div className="mb-6 space-y-3">
            {/* Show scanned pages count */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={showPagesCrawled}
                onChange={() => setShowPagesCrawled((prev) => !prev)}
              />
              <span className="text-gray-300">
                {t("exportShowPagesCrawled")}
              </span>
            </label>

            {/* Include company name */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeCompanyName}
                onChange={() => setIncludeCompanyName((prev) => !prev)}
              />
              <span className="text-gray-300">
                {t("exportIncludeCompanyName")}
                {!hasCompanyName && (
                  <>
                    {" "}
                    <span className="text-xs text-gray-500">
                      {t.rich("exportCompanyNameHint", {
                        link: (chunks) => (
                          <Link
                            href="/app/settings?tab=branding"
                            className="text-gray-500 hover:text-copper transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </span>
                  </>
                )}
              </span>
            </label>

            {/* Include company logo */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeCompanyLogo}
                onChange={() => setIncludeCompanyLogo((prev) => !prev)}
              />
              <span className="text-gray-300">
                {t("exportIncludeLogo")}
                {!hasCompanyLogo && (
                  <>
                    {" "}
                    <span className="text-xs text-gray-500">
                      {t.rich("exportLogoHint", {
                        link: (chunks) => (
                          <Link
                            href="/app/settings?tab=branding"
                            className="text-gray-500 hover:text-copper transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </span>
                  </>
                )}
              </span>
            </label>
          </div>
        )}

        {/* Spacer when no toggles shown */}
        {!isDocumentFormat && <div className="mb-6" />}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onExport(selectedFormat, lang, { includeCompanyName, includeCompanyLogo, showPagesCrawled })}
            disabled={loading}
            className="flex-1 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("generating", { format: selectedFormat.toUpperCase() })}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                {t("exportDownload")}
              </span>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-900"
          >
            {t("cancel")}
          </button>
        </div>

        {/* Generation hint */}
        {loading && (
          <p className="mt-3 text-center text-xs text-gray-500">
            {t("exportGeneratingHint")}
          </p>
        )}
      </div>
    </div>
  );
}
