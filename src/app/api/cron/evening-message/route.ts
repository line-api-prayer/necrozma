import { NextResponse } from "next/server";
import { broadcastMessage } from "~/server/lib/line/messaging-client";

// Ensure this route is dynamic so it's not cached
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Verify the request is coming from Vercel Cron
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    // TODO: Customize your evening broadcast message here!
    const message =
      "สวัสดีค่ะ 🙏 ขออภัยที่รบกวนเวลาพักผ่อนนะคะ\nพรุ่งนี้เรามีรอบทำบุญใหม่ เปิดรับออเดอร์แล้วค่ะ สามารถสั่งผ่าน MyShop ได้เลยนะคะ 😊";

    await broadcastMessage(message);

    return NextResponse.json({
      success: true,
      message: "Broadcasted successfully",
    });
  } catch (error) {
    console.error("Error broadcasting evening message:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
