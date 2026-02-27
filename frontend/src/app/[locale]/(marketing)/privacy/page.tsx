import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("marketing.privacy");

  const sections = [
    "operator",
    "dataCollected",
    "dataUsage",
    "thirdPartyServices",
    "dataSharing",
    "dataRetention",
    "userRights",
    "cookies",
    "contact",
  ] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-sm text-gray-500">{t("lastUpdated")}</p>

      <div className="mt-10 space-y-8">
        {sections.map((section, i) => (
          <div key={section}>
            <h2 className="text-xl font-semibold text-white">
              {i + 1}. {t(`sections.${section}.heading`)}
            </h2>
            <p className="mt-3 leading-relaxed text-gray-300 whitespace-pre-line">
              {t(`sections.${section}.body`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
