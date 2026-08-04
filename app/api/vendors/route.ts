import { getWorkspaceActor } from "../../lib/access";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  try {
    const actor = await getWorkspaceActor(); if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
    const supabase = await createClient(); const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() ?? ""; const type = params.get("type"); const status = params.get("status"); const category = params.get("category"); const expertise = params.get("expertise");
    let ids: string[] | null = null;
    if (q) { const result = await supabase.rpc("search_vendor_company_ids", { search_term: q }); if (result.error) throw result.error; ids = (result.data ?? []).map((row: { vendor_id: string }) => row.vendor_id); }
    if (category) { const result = await supabase.from("vendor_categories").select("vendor_id").eq("category_id", category); if (result.error) throw result.error; const found = result.data.map(row => row.vendor_id); ids = ids === null ? found : ids.filter(id => found.includes(id)); }
    if (expertise) { const result = await supabase.from("vendor_expertise").select("vendor_id").eq("expertise_id", expertise); if (result.error) throw result.error; const found = result.data.map(row => row.vendor_id); ids = ids === null ? found : ids.filter(id => found.includes(id)); }
    let query = supabase.from("vendor_companies").select("id,legal_name,display_name,vendor_type,country_code,status,updated_at,vendor_contacts(count),vendor_expertise(count),vendor_relationships(count)", { count: "exact" }).order("display_name").range(0, 99);
    if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]); if (type) query = query.eq("vendor_type", type); if (status) query = query.eq("status", status);
    const [vendors, categories, expertiseOptions] = await Promise.all([query, supabase.from("categories").select("id,name").eq("enabled", true).order("sort_order"), supabase.from("expertise").select("id,name").eq("enabled", true).order("sort_order")]);
    if (vendors.error || categories.error || expertiseOptions.error) throw vendors.error ?? categories.error ?? expertiseOptions.error;
    return Response.json({ vendors: vendors.data, total: vendors.count ?? 0, filters: { categories: categories.data, expertise: expertiseOptions.data } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load vendors." }, { status: 500 }); }
}
