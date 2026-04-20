import type { NextApiRequest, NextApiResponse } from "next";

type ViewStore = {
  count: number;
};

declare global {
  var __solnuvPitchViews: ViewStore | undefined;
}

const store: ViewStore = global.__solnuvPitchViews ?? { count: 50 };
if (!global.__solnuvPitchViews) {
  global.__solnuvPitchViews = store;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "POST") {
    store.count += 1;
  }

  return res.status(200).json({
    count: store.count,
    source: "live-api-increment",
    updatedAt: new Date().toISOString(),
  });
}
