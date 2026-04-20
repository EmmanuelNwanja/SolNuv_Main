import type { NextApiRequest, NextApiResponse } from "next";
import { dashboardAPI } from "../../../services/api";

type StatsResponse = {
  users: number;
  transactions: number;
  projects: number;
  recovered_projects: number;
  ai_reviews: number;
  source: string;
  updatedAt: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsResponse | { error: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await dashboardAPI.getPublicSummary();
    const payload = response?.data?.data || {};
    const totals = payload.totals || {};
    const ai = payload.ai || {};

    return res.status(200).json({
      users: Number(totals.users || totals.user_count || 0),
      transactions: Number(
        totals.transactions || totals.transaction_count || totals.simulation_runs || 0,
      ),
      projects: Number(totals.projects || 0),
      recovered_projects: Number(totals.recovered_projects || 0),
      ai_reviews: Number(ai.design_feedback_generated_count || 0),
      source: "solnuv-public-summary",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(200).json({
      users: 1000,
      transactions: 1000,
      projects: 0,
      recovered_projects: 0,
      ai_reviews: 0,
      source: "fallback",
      updatedAt: new Date().toISOString(),
    });
  }
}
