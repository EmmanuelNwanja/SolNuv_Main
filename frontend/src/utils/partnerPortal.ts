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
  if (types.includes("training_institute")) return "/partners/training";
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

export function hasPartnerTrainingInstitute(profile: AppUserProfile | null | undefined): boolean {
  return getPartnerMemberships(profile).some((m) => m.organization?.organization_type === "training_institute");
}

/** Home route for the main app shell logo and post-login “home” for the signed-in user. */
export function getAppHomePath(profile: AppUserProfile | null | undefined): string {
  const portal = getPartnerPortalPath(profile);
  if (portal) return portal;
  const ut = typeof profile?.user_type === "string" ? profile.user_type.toLowerCase() : "";
  if (ut === "training_institute") return "/partners/training";
  if (ut === "recycler") return "/partners/recycling";
  if (ut === "financier") return "/partners/finance";
  return "/dashboard";
}

export function isPartnerUserType(profile: AppUserProfile | null | undefined): boolean {
  const ut = typeof profile?.user_type === "string" ? profile.user_type.toLowerCase() : "";
  return ut === "recycler" || ut === "financier" || ut === "training_institute";
}
