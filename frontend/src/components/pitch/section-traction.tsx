"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";

import { Button } from "../ui/button";
import { Card } from "./ui";

const customersImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/customers.png";

type LiveStats = {
  users: number;
  transactions: number;
  projects: number;
  recovered_projects: number;
  ai_reviews: number;
  source: string;
  updatedAt: string;
};

export function SectionTraction() {
  const [users, setUsers] = useState(0);
  const [simulationRuns, setSimulationRuns] = useState(0);
  const [projects, setProjects] = useState(0);
  const [recoveredProjects, setRecoveredProjects] = useState(0);
  const [aiReviews, setAiReviews] = useState(0);
  const [liveMeta, setLiveMeta] = useState<{ source: string; updatedAt: string } | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const response = await fetch("/api/pitch/stats");
        const data = (await response.json()) as LiveStats;
        setUsers(Number(data.users ?? 0));
        setSimulationRuns(Number(data.transactions ?? 0));
        setProjects(Number(data.projects ?? 0));
        setRecoveredProjects(Number(data.recovered_projects ?? 0));
        setAiReviews(Number(data.ai_reviews ?? 0));
        setLiveMeta({ source: data.source, updatedAt: data.updatedAt });
      } catch {
        // ignore
      }
    }

    void fetchCount();
  }, []);

  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Signals</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="space-y-8">
            <Card className="min-h-[250px] sm:min-h-[300px] md:min-h-[365px] border-emerald-500/35 bg-forest-900/30">
              <h2 className="text-2xl font-display text-emerald-100">Projects registered</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                Portfolio objects flowing through the platform’s structured lifecycle—not slide decks pretending to be systems.
              </p>
              <div className="flex items-center space-x-4">
                <span className="relative ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="mt-auto font-mono text-5xl sm:text-7xl md:text-[122px]">
                  {Intl.NumberFormat("en", { notation: "compact" }).format(projects || 0)}
                </span>
              </div>
            </Card>

            <Card className="min-h-[250px] sm:min-h-[300px] md:min-h-[365px] border-amber-500/35 bg-amber-900/15">
              <h2 className="text-2xl font-display text-amber-100">Lifecycle recoveries</h2>
              <p className="text-amber-50/75 text-sm text-center">
                Decommissioned / recycled project records—proof the OS tracks outcomes, not just origination.
              </p>
              <div className="flex items-center space-x-4">
                <span className="relative ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="mt-auto font-mono text-5xl sm:text-7xl md:text-[122px]">
                  {Intl.NumberFormat("en", { notation: "compact" }).format(recoveredProjects || 0)}
                </span>
              </div>
            </Card>
          </div>
          <div className="space-y-8">
            <Card className="min-h-[250px] sm:min-h-[300px] md:min-h-[365px] border-emerald-500/25 bg-slate-900/80">
              <h2 className="text-2xl font-display text-slate-100">Operator accounts</h2>
              <p className="text-slate-300 text-sm text-center">
                Teams with identities inside the workspace—foundation for seats, partners, and audit trails.
              </p>
              <div className="flex items-center space-x-4">
                <span className="relative ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="mt-auto font-mono text-5xl sm:text-7xl md:text-[122px]">{users}</span>
              </div>
            </Card>

            <Card className="min-h-[250px] sm:min-h-[300px] md:min-h-[365px] border-amber-500/25 bg-slate-900/90">
              <h2 className="text-2xl font-display text-slate-100">Modelling depth</h2>
              <p className="text-slate-300 text-sm text-center">
                Simulation runs executed on-platform—where AI-assisted review compounds over time.
              </p>
              <div className="flex items-center space-x-4">
                <span className="relative ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="mt-auto font-mono text-5xl sm:text-7xl md:text-[122px]">
                  {Intl.NumberFormat("en", { notation: "compact" }).format(simulationRuns || 0)}
                </span>
              </div>
            </Card>
          </div>

          <div className="ml-auto w-full border border-emerald-500/25 p-4 md:p-6 bg-[#0C0C0C] relative">
            <div className="mb-8 flex items-center justify-between gap-4">
              <h2 className="block text-2xl sm:text-3xl md:text-[38px] font-display text-emerald-100 font-medium">
                AI review throughput
              </h2>
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                live fetched
              </span>
            </div>

            {liveMeta && (
              <p className="mb-8 text-[11px] text-[#878787]">
                source: {liveMeta.source} · updated: {new Date(liveMeta.updatedAt).toLocaleString()}
                <br />
                <span className="text-emerald-200/90 font-mono text-lg md:text-2xl block mt-3">
                  {Intl.NumberFormat("en", { notation: "compact" }).format(aiReviews || 0)}
                </span>
                <span className="text-slate-400">design reviews with AI expert feedback recorded</span>
              </p>
            )}

            <div className="static md:absolute md:w-[220px] md:bottom-6 md:left-[50%] md:-mt-5 md:-ml-[110px] flex justify-center mt-6 md:mt-0">
              <a
                href="https://twitter.com/search?q=solnuv&src=typed_query&f=top"
                target="_blank"
                rel="noreferrer"
              >
                <Button className="w-full flex items-center space-x-2 h-10">
                  <span>Public conversation on</span>
                  <FaXTwitter />
                </Button>
              </a>
            </div>

            <Image src={customersImage} width={698} height={900} alt="Customers" quality={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
