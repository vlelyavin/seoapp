import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing — SEO Tools",
  description:
    "Affordable SEO audit and indexing tools for freelancers and agencies.",
};

export default function PricingPage() {
  return <PricingSection />;
}
