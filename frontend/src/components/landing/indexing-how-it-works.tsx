"use client";

import { useTranslations } from "next-intl";
import { Link2, Search, Send } from "lucide-react";
import { motion } from "framer-motion";

const STEP_ICONS = [Link2, Search, Send] as const;

export function IndexingHowItWorks() {
  const t = useTranslations("marketing.indexingLanding.howItWorks");

  const steps = [
    { num: "01", icon: STEP_ICONS[0], title: t("step1Title"), desc: t("step1Desc") },
    { num: "02", icon: STEP_ICONS[1], title: t("step2Title"), desc: t("step2Desc") },
    { num: "03", icon: STEP_ICONS[2], title: t("step3Title"), desc: t("step3Desc") },
  ];

  return (
    <section className="bg-black py-24">
      <div className="mx-auto max-w-3xl px-4 lg:px-6">
        <p className="mb-4 text-center text-sm font-medium not-italic text-copper">
          {t("sectionLabel")}
        </p>
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          {t("title")}
        </h2>

        <div className="relative mt-16">
          {/* Vertical timeline line */}
          <div
            className="absolute top-0 bottom-0 left-6 w-px bg-gradient-to-b from-copper/40 via-copper/20 to-transparent sm:left-8"
            aria-hidden="true"
          />

          <div className="flex flex-col gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative flex gap-6 sm:gap-8"
              >
                {/* Node */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-copper/30 bg-gray-950 sm:h-16 sm:w-16">
                  <step.icon className="h-5 w-5 text-copper sm:h-6 sm:w-6" />
                </div>

                {/* Card */}
                <div className="flex-1 rounded-xl border border-gray-800 bg-gray-950 p-6">
                  <span className="text-sm font-semibold text-copper/50">
                    {step.num}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-gray-400">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
