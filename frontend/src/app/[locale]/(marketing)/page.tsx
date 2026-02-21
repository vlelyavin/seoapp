"use client";

import { useTranslations } from "next-intl";

export default function LandingPage() {
  const t = useTranslations("marketing.landing");

  return (
    <div className="mx-auto max-w-4xl px-4 py-24 text-center lg:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-4 text-lg text-gray-400">
        {t("subtitle")}
      </p>
    </div>
  );
}
