"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExportFormat } from "@/lib/plan-capabilities";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: string, lang: string) => void;
  loading?: boolean;
  defaultLang?: string;
  formatOptions?: ExportFormat[];
}

const ALL_FORMAT_OPTIONS: Record<ExportFormat, string> = {
  pdf: "PDF",
  html: "HTML",
  docx: "DOCX",
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
}: ExportDialogProps) {
  const t = useTranslations("audit");
  const resolvedFormatOptions =
    formatOptions && formatOptions.length > 0 ? formatOptions : (["pdf", "html", "docx"] as ExportFormat[]);
  const [format, setFormat] = useState<ExportFormat>(() => resolvedFormatOptions[0]);
  const [lang, setLang] = useState(defaultLang);
  const selectedFormat = resolvedFormatOptions.includes(format)
    ? format
    : resolvedFormatOptions[0];

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
      <div className="relative z-10 mx-5 w-full max-w-md rounded-xl border bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
          <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {t("exportDialogTitle")}
        </h3>

        {/* Message */}
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
          {t("exportDialogMessage")}
        </p>

        {/* Format select */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("exportFormat")}
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            disabled={loading}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
          >
            {resolvedFormatOptions.map((opt) => (
              <option key={opt} value={opt}>
                {ALL_FORMAT_OPTIONS[opt]}
              </option>
            ))}
          </select>
        </div>

        {/* Language select */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("exportLanguage")}
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onExport(selectedFormat, lang)}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("generating", { format: selectedFormat.toUpperCase() })}
              </span>
            ) : (
              t("exportDownload")
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t("cancel")}
          </button>
        </div>

        {/* Generation hint */}
        {loading && (
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            {t("exportGeneratingHint")}
          </p>
        )}
      </div>
    </div>
  );
}
