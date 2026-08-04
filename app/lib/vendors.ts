export type VendorSummary = {
  id: string; legal_name: string; display_name: string; vendor_type: string;
  country_code: string | null; status: string; updated_at: string;
  vendor_contacts: { count: number }[]; vendor_expertise: { count: number }[];
  vendor_relationships: { count: number }[];
};

export const vendorTypes = ["manufacturer", "distributor", "agent", "system_integrator", "contractor", "service_provider", "other"] as const;

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
