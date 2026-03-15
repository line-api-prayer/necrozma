import { messagingApi } from "@line/bot-sdk";
import { env } from "~/env.js";
import { formatThaiLongDate, formatThaiShortDate } from "~/server/lib/operations-date";
import { buildServiceRequestUrl } from "~/server/lib/service-request";

const isTestMode = env.ENABLE_TEST_MODE === "true";

const customerChannelAccessToken = (isTestMode
  ? env.LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN
  : env.LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN) ?? "";

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
  certificatePdfUrl: string,
  dashboardUrl: string,
) {
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
        type: "flex",
        altText: `สรุปรายการออเดอร์สำหรับวันถัดไป ${formatThaiShortDate(stats.date)}: ${stats.totalOrders} ออเดอร์`,
        contents: createDailySummaryFlexMessage(stats, pdfUrl, certificatePdfUrl, dashboardUrl),
      },
    ],
  });
}

function createDailySummaryFlexMessage(
  stats: {
    date: string;
    totalOrders: number;
    totalRevenue: number;
    items: { name: string; qty: number; total: number }[];
    orders: string[];
  },
  pdfUrl: string,
  certificatePdfUrl: string,
  dashboardUrl: string,
): messagingApi.FlexBubble {
  const itemLines =
    stats.items.length > 0
      ? stats.items.slice(0, 6).map((item) => `• ${item.name} ${item.qty} ชุด = ${item.total.toLocaleString()} บาท`)
      : ["• ไม่มีรายการ"];
  const orderLines =
    stats.orders.length > 0
      ? stats.orders.slice(0, 8).map((orderNo) => orderNo.slice(-8))
      : ["-"];
  const hiddenItemCount = Math.max(0, stats.items.length - itemLines.length);
  const hiddenOrderCount = Math.max(0, stats.orders.length - orderLines.length);

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#14532d",
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: "สรุปรายการออเดอร์ล่วงหน้า",
          color: "#bbf7d0",
          size: "sm",
          weight: "bold",
        },
        {
          type: "text",
          text: formatThaiLongDate(stats.date),
          color: "#ffffff",
          size: "xl",
          weight: "bold",
          margin: "sm",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        summaryText(`💰 สรุปรายการออเดอร์สำหรับวันถัดไป ${formatThaiShortDate(stats.date)}`, "md", true),
        summaryText("ร้านค้า: ฝากใส่บาตร", "sm", false, "#4b5563"),
        { type: "separator", margin: "sm" },
        summaryText("📊 สรุปงานวันถัดไป", "sm", true),
        summaryText(`• วันดำเนินงาน: ${formatThaiLongDate(stats.date)}`, "sm"),
        summaryText(`• จำนวนออเดอร์: ${stats.totalOrders} ออเดอร์`, "sm"),
        summaryText(`• ยอดรวมทั้งหมด: ${stats.totalRevenue.toLocaleString()} บาท`, "sm"),
        { type: "separator", margin: "sm" },
        summaryText("📦 รายการที่ขายได้", "sm", true),
        ...itemLines.map((line) => summaryText(line, "sm")),
        ...(hiddenItemCount > 0
          ? [summaryText(`และอีก ${hiddenItemCount} รายการ`, "xs", false, "#6b7280")]
          : []),
        { type: "separator", margin: "sm" },
        summaryText("🧾 Order ID", "sm", true),
        ...orderLines.map((line) => summaryText(line, "sm")),
        ...(hiddenOrderCount > 0
          ? [summaryText(`และอีก ${hiddenOrderCount} ออเดอร์`, "xs", false, "#6b7280")]
          : []),
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        linkButton("ใบสรุปออเดอร์", pdfUrl, "#111827"),
        linkButton("ใบประกาศ / Certificate", certificatePdfUrl, "#374151"),
        linkButton("แดชบอร์ดพนักงาน", dashboardUrl, "#06c755"),
      ],
    },
  };
}

function summaryText(
  text: string,
  size: "xs" | "sm" | "md",
  bold = false,
  color = "#111827",
): messagingApi.FlexText {
  return {
    type: "text",
    text,
    size,
    color,
    weight: bold ? "bold" : "regular",
    wrap: true,
  };
}

function linkButton(label: string, uri: string, color: string): messagingApi.FlexButton {
  return {
    type: "button",
    style: "primary",
    color,
    action: {
      type: "uri",
      label,
      uri,
    },
    height: "sm",
  };
}

export async function sendServiceRequestPrompt(
  lineUid: string | null,
  order: { lineOrderNo: string; customerName: string },
) {
  const targetUserId =
    isTestMode && env.DEV_TEST_USER_ID ? env.DEV_TEST_USER_ID : lineUid;

  if (!targetUserId) {
    return false;
  }

  if (isTestMode && env.DEV_TEST_USER_ID && lineUid) {
    console.warn(
      `[TEST MODE] Redirecting service request prompt from ${lineUid} to ${targetUserId}`,
    );
  }

  const formUrl = buildServiceRequestUrl(order.lineOrderNo);

  await client.pushMessage({
    to: targetUserId,
    messages: [
      {
        type: "flex",
        altText: `กรอกวันดำเนินงานสำหรับคำสั่งซื้อ ${order.lineOrderNo}`,
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#7c2d12",
            paddingAll: "lg",
            contents: [
              {
                type: "text",
                text: "ยืนยันวันดำเนินงาน",
                size: "lg",
                weight: "bold",
                color: "#fff7ed",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: `${order.customerName || "ลูกค้า"} รบกวนแจ้งวันดำเนินงานและคำขอพรสำหรับคำสั่งซื้อนี้ด้วยนะคะ`,
                wrap: true,
                size: "sm",
                color: "#374151",
              },
              {
                type: "text",
                text: `Order No: ${order.lineOrderNo}`,
                wrap: true,
                size: "sm",
                color: "#111827",
                weight: "bold",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              linkButton("แจ้งข้อมูลตอนนี้", formUrl, "#ea580c"),
            ],
          },
        },
      },
    ],
  });

  return true;
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
