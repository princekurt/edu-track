import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildReportData, isReportType } from "@/lib/reports";
import { toCsv } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isReportType(type)) {
    return new Response("Unknown report type.", { status: 404 });
  }

  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return new Response("Not authenticated.", { status: 401 });
  }
  if (profile.role === "scholar") {
    return new Response("Not authorized.", { status: 403 });
  }

  const url = new URL(request.url);
  const periodId = url.searchParams.get("period") || undefined;

  const supabase = await createClient();
  const data = await buildReportData(supabase, type, periodId);
  if (!data) {
    return new Response("No reporting period available.", { status: 404 });
  }

  const csv = toCsv(data.headers, data.rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
