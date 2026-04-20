import Head from "next/head";
import { PitchCarusel } from "../../components/pitch/pitch-carousel";
import { Grid } from "../../components/pitch/ui";
import CmsRuntimeContent from "../../components/CmsRuntimeContent";

export default function PitchPage() {
  return (
    <>
      <Head>
        <title>SolNuv Pitch Deck</title>
        <meta
          name="description"
          content="Pitch deck experience mirrored from the source fork, adapted for SolNuv branding."
        />
      </Head>
      <div className="min-h-screen bg-[#0C0C0C] text-white relative overflow-hidden font-['Inter',sans-serif]">
        <Grid />
        <div className="relative z-10 px-4 pt-4">
          <CmsRuntimeContent routePath="/pitch" />
        </div>
        <PitchCarusel />
      </div>
    </>
  );
}
