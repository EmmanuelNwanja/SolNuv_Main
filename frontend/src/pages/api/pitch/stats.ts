import type { NextApiRequest, NextApiResponse } from "next";
import { dashboardAPI } from "../../../services/api";

type StatsResponse = {
  users: number;
  transactions: number;
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
    const totals = response?.data?.data?.totals || {};

    return res.status(200).json({
      users: Number(totals.users || totals.user_count || 0),
      transactions: Number(
        totals.transactions || totals.transaction_count || totals.simulation_runs || 0,
      ),
      source: "solnuv-public-summary",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(200).json({
      users: 1000,
      transactions: 1000,
      source: "fallback",
      updatedAt: new Date().toISOString(),
    });
  }
}
