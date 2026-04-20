import Head from "next/head";
import type { ReactElement } from "react";
import { getPublicLayout } from "../../components/Layout";
import { PitchCarousel } from "../../components/pitchdeck/pitch-carousel";

export default function PitchPage() {
  return (
    <>
      <Head>
        <title>SolNuv Pitch Deck — Solar Lifecycle Intelligence</title>
        <meta
          name="description"
          content="Explore SolNuv's pitch deck: the lifecycle intelligence platform for dependable solar operations, compliance, and partner coordination."
        />
      </Head>
      <PitchCarousel />
    </>
  );
}

PitchPage.getLayout = function getLayout(page: ReactElement) {
  return getPublicLayout(page);
};
