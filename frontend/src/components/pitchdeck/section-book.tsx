import Link from "next/link";
import { RiArrowRightLine } from "react-icons/ri";
import { PitchSlideFrame } from "./ui";

export function SectionBook() {
  return (
    <PitchSlideFrame
      eyebrow="Call to Action"
      title="Partner with SolNuv to scale dependable solar operations"
      lead="We are onboarding strategic operators, financiers, recyclers, and enterprise buyers that need a trusted lifecycle intelligence layer."
    >
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
        <p className="text-sm sm:text-base text-slate-700 max-w-2xl">
          Schedule a product walkthrough to explore workflow fit, integration options, and enterprise rollout plans.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/contact" className="btn-primary inline-flex items-center gap-2">
            Book a meeting <RiArrowRightLine />
          </Link>
          <Link href="/register" className="btn-ghost inline-flex items-center gap-2">
            Create account <RiArrowRightLine />
          </Link>
        </div>
      </div>
    </PitchSlideFrame>
  );
}
