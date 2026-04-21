import Head from "next/head";
import { PitchCarusel } from "../../components/pitch/pitch-carousel";
import { Grid } from "../../components/pitch/ui";

export default function PitchPage() {
  return (
    <>
      <Head>
        <title>SolNuv — Investor narrative (pitch)</title>
        <meta
          name="description"
          content="SolNuv pitch: AI-native solar operating system, verification layer, and partner rails—complementary to the public homepage."
        />
      </Head>
      <div className="min-h-screen md:h-[100svh] md:overflow-hidden bg-[#0C0C0C] text-white relative overflow-hidden font-['Inter',sans-serif]">
        <Grid />
        <PitchCarusel />
      </div>
    </>
  );
}
