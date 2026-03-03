import { messagingApi } from "@line/bot-sdk";
import { env } from "~/env.js";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

export async function sendApprovalNotification(
  lineUid: string,
  order: { lineOrderNo: string; customerName: string; totalPrice: number },
  evidencePhotoUrl?: string,
) {
  const flexMessage = createApprovalFlexMessage(order, evidencePhotoUrl);

  await client.pushMessage({
    to: lineUid,
    messages: [flexMessage],
  });
}

export async function sendRejectionNotification(
  lineUid: string,
  order: { lineOrderNo: string; customerName: string },
  reason: string,
) {
  await client.pushMessage({
    to: lineUid,
    messages: [
      {
        type: "text",
        text: `แจ้งเตือน: คำสั่งซื้อ ${order.lineOrderNo}\n\nหลักฐานการดำเนินการถูกส่งกลับแก้ไข\nเหตุผล: ${reason}\n\nกรุณาติดต่อเจ้าหน้าที่เพื่อดำเนินการใหม่`,
      },
    ],
  });
}

export async function sendDailySummaryToAdmin(
  adminLineUid: string,
  stats: { date: string; totalOrders: number; totalRevenue: number },
  pdfUrl: string,
  csvUrl: string,
) {
  await client.pushMessage({
    to: adminLineUid,
    messages: [
      {
        type: "text",
        text: `📊 สรุปประจำวัน ${stats.date}\n\nจำนวนออเดอร์: ${stats.totalOrders} รายการ\nยอดรวม: ฿${stats.totalRevenue.toLocaleString()}\n\nPDF: ${pdfUrl}\nCSV: ${csvUrl}`,
      },
    ],
  });
}

function createApprovalFlexMessage(
  order: { lineOrderNo: string; customerName: string; totalPrice: number },
  _photoUrl?: string,
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `อนุมัติงานเรียบร้อย — คำสั่งซื้อ ${order.lineOrderNo}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "อนุมัติงานเรียบร้อย ✅",
            weight: "bold",
            size: "lg",
            color: "#22c55e",
          },
        ],
        backgroundColor: "#f0fdf4",
        paddingAll: "lg",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `คำสั่งซื้อ: ${order.lineOrderNo}`,
            size: "sm",
            color: "#374151",
            wrap: true,
          },
          {
            type: "text",
            text: `ลูกค้า: ${order.customerName}`,
            size: "sm",
            color: "#374151",
            margin: "md",
          },
          {
            type: "text",
            text: `ยอดเงิน: ฿${order.totalPrice.toLocaleString()}`,
            size: "sm",
            color: "#374151",
            margin: "md",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "พิธีได้ดำเนินการเรียบร้อยแล้ว ขอให้เจริญรุ่งเรืองยิ่งๆ ขึ้นไปค่ะ/ครับ 🙏",
            size: "sm",
            color: "#6b7280",
            wrap: true,
            margin: "lg",
          },
        ],
        paddingAll: "lg",
      },
    },
  };
}
