import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateAndSendDailySummary();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
