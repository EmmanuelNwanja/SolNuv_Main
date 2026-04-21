import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { queryParamToString } from '../../../utils/nextRouter';
import { designReportAPI } from '../../../services/api';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { MotionSection } from '../../../components/PageMotion';
import ReportGovernancePanels from '../../../components/reports/ReportGovernancePanels';
import { RiArrowLeftLine } from 'react-icons/ri';

export default function ResultsV2Page() {
  const router = useRouter();
  const projectId = queryParamToString(router.query.id);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data } = await designReportAPI.getHtmlData(projectId);
        setPayload(data?.data || data);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) return <LoadingSpinner />;

  const result = payload?.result || {};
  const project = payload?.project || {};

  return (
    <>
      <Head>
        <title>Results V2 | {project?.name || 'Project'} | SolNuv</title>
      </Head>
      <MotionSection className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-forest-900 dark:text-white">Results V2 Preview</h1>
            <p className="text-sm text-slate-500 mt-1">
              Enhanced report trust layer with formulas, precision legend, assumptions, uncertainty, and provenance.
            </p>
          </div>
          <Link href={`/projects/${projectId}/results`} className="btn-secondary text-sm inline-flex items-center gap-1">
            <RiArrowLeftLine /> Back to Classic Results
          </Link>
        </div>

        <div className="card p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This preview route is intentionally additive and non-breaking. It uses the existing results payload and renders
            V2 governance sections without changing the current production report flow.
          </p>
        </div>

        <ReportGovernancePanels
          formulaEntries={(result?.extended_metrics?.formula_registry_entries as any[]) || []}
          assumptions={(result?.extended_metrics?.assumptions as string[]) || []}
          limitations={(result?.extended_metrics?.limitations as string[]) || []}
          uncertainty={result?.extended_metrics?.uncertainty || null}
          provenance={result?.run_provenance || null}
        />
      </MotionSection>
    </>
  );
}

ResultsV2Page.getLayout = getDashboardLayout;
