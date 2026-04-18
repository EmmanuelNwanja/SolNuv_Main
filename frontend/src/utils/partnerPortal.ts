import type { AppUserProfile } from "../types/contracts";

export interface PartnerMembership {
  role_code?: string | null;
  organization?: {
    id?: string;
    name?: string | null;
    organization_type?: string | null;
    verification_status?: string | null;
    jurisdiction?: string | null;
  } | null;
}

export function getPartnerMemberships(profile: AppUserProfile | null | undefined): PartnerMembership[] {
  const raw = profile?.partner_memberships;
  if (!Array.isArray(raw)) return [];
  return raw as PartnerMembership[];
}

export function getPartnerPortalPath(profile: AppUserProfile | null | undefined): string | null {
  const memberships = getPartnerMemberships(profile);
  if (!memberships.length) return null;
  const types = memberships.map((m) => m.organization?.organization_type).filter(Boolean) as string[];
  if (types.includes("recycler") && !types.includes("financier")) return "/partners/recycling";
  if (types.includes("financier") && !types.includes("recycler")) return "/partners/finance";
  if (types.includes("recycler")) return "/partners/recycling";
  if (types.includes("financier")) return "/partners/finance";
  return null;
}

export function hasPartnerRecycler(profile: AppUserProfile | null | undefined): boolean {
  return getPartnerMemberships(profile).some((m) => m.organization?.organization_type === "recycler");
}

export function hasPartnerFinancier(profile: AppUserProfile | null | undefined): boolean {
  return getPartnerMemberships(profile).some((m) => m.organization?.organization_type === "financier");
}
