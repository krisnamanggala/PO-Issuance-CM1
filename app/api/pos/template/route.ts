import { getWorkspaceActor } from "@/app/lib/access";
import { buildPOExcelTemplate } from "@/app/lib/po-excel";

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const workbook = await buildPOExcelTemplate();
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=po-register-import-template.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "The Excel template could not be created." }, { status: 500 });
  }
}
