import Head from 'next/head';
import Link from 'next/link';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import { RiArrowLeftLine, RiArticleLine, RiRulerLine, RiFunctionLine, RiShieldCheckLine } from 'react-icons/ri';

export default function ReportDesignSystemPage() {
  return (
    <>
      <Head>
        <title>Report Design System | SolNuv</title>
      </Head>

      <MotionSection className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-forest-900 dark:text-white">Report Design System</h1>
            <p className="text-sm text-slate-500 mt-1">
              Internal reference for report UI, formula transparency, precision policy, and auditability.
            </p>
          </div>
          <Link href="/reports" className="btn-secondary text-sm inline-flex items-center gap-1">
            <RiArrowLeftLine /> Back to Reports
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiArticleLine className="text-emerald-600" />
              <h2 className="font-semibold text-forest-900 dark:text-white">Report Structure</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Every V2 report should include formula references, assumptions and limitations, uncertainty decomposition,
              and provenance audit blocks.
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiRulerLine className="text-blue-600" />
              <h2 className="font-semibold text-forest-900 dark:text-white">Units & Precision</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Calculations must carry canonical units and deterministic rounding. Presentation layers can format for readability,
              but raw values remain reproducible.
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiFunctionLine className="text-purple-600" />
              <h2 className="font-semibold text-forest-900 dark:text-white">Formula Governance</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Formula IDs and versions are governed in a registry, with test vectors and invariant checks for each active formula.
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiShieldCheckLine className="text-amber-600" />
              <h2 className="font-semibold text-forest-900 dark:text-white">Audit & Traceability</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Provenance metadata should expose engine version, input hash, weather dataset hash, and formula bundle hash
              for each generated report.
            </p>
          </div>
        </div>
      </MotionSection>
    </>
  );
}

ReportDesignSystemPage.getLayout = getDashboardLayout;
