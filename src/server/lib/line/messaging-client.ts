import { messagingApi } from "@line/bot-sdk";
import { env } from "~/env.js";

const isTestMode = env.ENABLE_TEST_MODE === "true";

const customerChannelAccessToken = isTestMode
  ? env.LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN
  : env.LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN;

export const client = new messagingApi.MessagingApiClient({
  channelAccessToken: customerChannelAccessToken,
});

export const adminClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN,
});

export async function sendApprovalNotification(
  lineUid: string,
  order: { lineOrderNo: string; customerName: string; totalPrice: number },
  evidencePhotoUrl?: string,
  evidenceVideoUrl?: string,
) {
  const messages: messagingApi.Message[] = [
    createApprovalFlexMessage(order, evidencePhotoUrl),
  ];

  if (evidenceVideoUrl && evidencePhotoUrl) {
    messages.push({
      type: "video",
      originalContentUrl: evidenceVideoUrl,
      previewImageUrl: evidencePhotoUrl,
    });
  }

  const targetUserId =
    isTestMode && env.DEV_TEST_USER_ID ? env.DEV_TEST_USER_ID : lineUid;

  if (isTestMode && env.DEV_TEST_USER_ID) {
    console.warn(
      `[TEST MODE] Redirecting approval message from ${lineUid} to ${targetUserId}`,
    );
  }

  await client.pushMessage({
    to: targetUserId,
    messages,
  });
}

export async function sendRejectionNotification(
  lineUid: string,
  order: { lineOrderNo: string; customerName: string },
  reason: string,
) {
  const targetUserId =
    isTestMode && env.DEV_TEST_USER_ID ? env.DEV_TEST_USER_ID : lineUid;

  if (isTestMode && env.DEV_TEST_USER_ID) {
    console.warn(
      `[TEST MODE] Redirecting rejection message from ${lineUid} to ${targetUserId}`,
    );
  }

  await client.pushMessage({
    to: targetUserId,
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
  stats: {
    date: string;
    totalOrders: number;
    totalRevenue: number;
    items: { name: string; qty: number; total: number }[];
    orders: string[];
  },
  pdfUrl: string,
  csvUrl: string,
) {
  const dateStr = new Date(stats.date).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  let messageText = `💰 สรุปรายการออเดอร์ ประจำวันที่ ${dateStr}\n`;
  messageText += `ร้านค้า: ฝากใส่บาตร\n\n`;
  messageText += `━━━━━━━━━━━━━━\n\n`;
  
  messageText += `📊 สรุปวันนี้\n`;
  messageText += `• จำนวนออเดอร์: ${stats.totalOrders} ออเดอร์\n`;
  messageText += `• ยอดรวมทั้งหมด: ${stats.totalRevenue.toLocaleString()} บาท\n\n`;
  messageText += `━━━━━━━━━━━━━━\n\n`;

  messageText += `📦 รายการที่ขายได้\n`;
  if (stats.items.length > 0) {
    stats.items.forEach((item) => {
      // The user's template simplifies names up to the first ' ' if they are long, but to be safe let's just use the item.name
      // Alternatively, we can just print the exact mapping. The user said: "• ใส่บาตร ชุด S ร่ำรวย 2 ชุด = 198 บาท"
      messageText += `• ${item.name} ${item.qty} ชุด = ${item.total} บาท\n`;
    });
  } else {
    messageText += `• ไม่มีรายการ\n`;
  }
  messageText += `\n━━━━━━━━━━━━━━\n\n`;

  messageText += `🧾 Order ID\n`;
  if (stats.orders.length > 0) {
    stats.orders.forEach(o => {
      // The user requested short prefixes "80252885" instead of full order trackings in the template. 
      // E.g string "2026030380252885", taking the last 8 digits.
      messageText += `${o.slice(-8)}\n`;
    });
  } else {
    messageText += `-\n`;
  }
  messageText += `\n━━━━━━━━━━━━━━\n\n`;

  messageText += `📎 ไฟล์\n`;
  messageText += `PDF: ${pdfUrl}\n`;
  messageText += `CSV: ${csvUrl}`;

  const targetUserId =
    isTestMode && env.DEV_TEST_USER_ID ? env.DEV_TEST_USER_ID : adminLineUid;

  if (isTestMode && env.DEV_TEST_USER_ID) {
    console.warn(
      `[TEST MODE] Redirecting daily summary from admin ${adminLineUid} to ${targetUserId}`,
    );
  }

  await adminClient.pushMessage({
    to: targetUserId,
    messages: [
      {
        type: "text",
        text: messageText,
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

export async function broadcastMessage(text: string) {
  await adminClient.broadcast({
    messages: [
      {
        type: "text",
        text,
      },
    ],
  });
}
