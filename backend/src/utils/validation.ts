/**
 * Validation Utilities
 * Common validation functions for the SolNuv backend
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(str: unknown): boolean {
  return typeof str === "string" && UUID_REGEX.test(str);
}

export function sanitizeString(str: unknown, maxLength = 1000): unknown {
  if (typeof str !== "string") return str;
  return str.trim().slice(0, maxLength);
}

export function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
}

export function validateUUIDParam(id: string, paramName: string): void {
  if (!isValidUUID(id)) {
    const error = new Error(`Invalid ${paramName}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }
}
