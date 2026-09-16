import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata = {
  title: "Pricing",
  description:
    "Transparent pricing for FlexFlow. Start free and upgrade when your team grows — cancel anytime, no hidden costs.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto w-full px-6 py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">Pricing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
            Start free, scale when your team grows.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-(--text-secondary)">
            Every plan includes unlimited projects, members, and real-time collaboration. Upgrade or
            cancel anytime — no hidden costs.
          </p>
        </div>
        <PricingContent />
      </div>
    </div>
  );
}