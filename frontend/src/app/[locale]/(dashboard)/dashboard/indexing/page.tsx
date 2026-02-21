"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

export default function IndexingPage() {
  const t = useTranslations("indexing");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Search className="mb-4 h-12 w-12 text-gray-600" />
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-sm text-gray-400">{t("comingSoon")}</p>
    </div>
  );
}
