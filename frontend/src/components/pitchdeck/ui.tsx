import type { PropsWithChildren } from "react";

type SlideProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  lead: string;
  accent?: "emerald" | "amber" | "slate";
}>;

export function PitchSlideFrame({ eyebrow, title, lead, accent = "emerald", children }: SlideProps) {
  const accentClass =
    accent === "amber"
      ? "text-amber-700 bg-amber-100 border-amber-200"
      : accent === "slate"
        ? "text-slate-700 bg-slate-100 border-slate-200"
        : "text-emerald-700 bg-emerald-100 border-emerald-200";

  return (
    <section className="h-full w-full rounded-3xl border border-slate-200 bg-white/95 backdrop-blur p-6 sm:p-8 lg:p-10 shadow-[0_20px_45px_rgba(2,8,23,0.08)]">
      <div className="h-full flex flex-col">
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${accentClass}`}
        >
          {eyebrow}
        </span>
        <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 leading-tight">{title}</h2>
        <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-3xl">{lead}</p>
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-display font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{detail}</p>
    </article>
  );
}
