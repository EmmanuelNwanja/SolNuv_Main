import Head from "next/head";
import Link from "next/link";
import { RiArrowRightLine, RiTimeLine } from "react-icons/ri";

export function ComingSoonFeaturePage({
  title,
  metaTitle,
  description,
  bullets,
  contextHint,
}: {
  title: string;
  metaTitle?: string;
  description: string;
  bullets: string[];
  contextHint?: string;
}) {
  return (
    <>
      <Head>
        <title>{metaTitle || `${title} — SolNuv`}</title>
        <meta name="description" content={description} />
      </Head>
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
          <RiTimeLine className="text-base" />
          Coming soon
        </span>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-forest-900 dark:text-white mt-4">{title}</h1>
        {contextHint && <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-2 font-medium">{contextHint}</p>}
        <p className="text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">{description}</p>
        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">→</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
          Want early access?{" "}
          <Link href="/contact" className="text-forest-800 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 hover:underline">
            Contact the team <RiArrowRightLine />
          </Link>
        </p>
      </div>
    </>
  );
}
