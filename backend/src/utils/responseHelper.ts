import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function sendError(
  res: Response,
  message = "An error occurred",
  statusCode = 500,
  extra: Record<string, unknown> = {}
) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
    timestamp: new Date().toISOString(),
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number | string,
  limit: number | string,
  message = "Success"
) {
  const pageNum = Number.parseInt(String(page), 10);
  const limitNum = Number.parseInt(String(limit), 10);

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      has_next: pageNum * limitNum < total,
      has_prev: pageNum > 1,
    },
    timestamp: new Date().toISOString(),
  });
}
