import { type OrderWithItems } from "~/server/lib/line/types";
import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";
// @ts-expect-error - pdfmake/js/Printer lacks a declaration file
import PdfPrinter from "pdfmake/js/Printer.js";
import path from "path";
import fs from "fs";

interface ReportData {
  date: string;
  orders: OrderWithItems[];
  totalRevenue: number;
  pendingCount: number;
  uploadedCount: number;
  completedCount: number;
}

export async function generatePdfBuffer(data: ReportData): Promise<Buffer> {
  // Use absolute paths for server-side pdfmake
  const fontsPath = path.resolve(process.cwd(), "public", "fonts");
  
  const fontFiles = {
    normal: path.join(fontsPath, "THSarabunNew.ttf"),
    bold: path.join(fontsPath, "THSarabunNew-Bold.ttf"),
    italics: path.join(fontsPath, "THSarabunNew-Italic.ttf"),
    bolditalics: path.join(fontsPath, "THSarabunNew-BoldItalic.ttf"),
  };

  // Verify files exist and log for debugging
  console.log(`[PDF] Loading fonts from: ${fontsPath}`);
  for (const [key, filePath] of Object.entries(fontFiles)) {
    if (!fs.existsSync(filePath)) {
      console.error(`[PDF] Missing font file for ${key}: ${filePath}`);
    }
  }

  const fonts = {
    // We MUST map Roboto to our Thai-supporting font
    Roboto: fontFiles,
    THSarabunNew: fontFiles,
  };

  // On server-side, we DO NOT pass the vfs object if using absolute paths
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const printer = new PdfPrinter(fonts);

  // Fetch product mappings
  const supabase = await supabaseClient();
  const { data: mappingData } = await supabase.from("product_mappings").select("original_name, display_name");
  const nameMap = new Map<string, string>();
  mappingData?.forEach(m => nameMap.set(m.original_name, m.display_name));

  const getDisplayName = (name: string) => nameMap.get(name) ?? name;

  const summaryItems: { name: string; qty: number; total: number }[] = [];
  
  data.orders.forEach(order => {
    order.items.forEach(item => {
      const displayName = getDisplayName(item.name);
      const existing = summaryItems.find(i => i.name === displayName);
      if (existing) {
        existing.qty += item.quantity;
        existing.total += Number(item.price) * item.quantity;
      } else {
        summaryItems.push({ name: displayName, qty: item.quantity, total: Number(item.price) * item.quantity });
      }
    });
  });

  const tableBody = [
    [
      { text: "#", style: "tableHeader" },
      { text: "Order No.", style: "tableHeader" },
      { text: "Ref Order No.", style: "tableHeader" },
      { text: "ชื่อ", style: "tableHeader" },
      { text: "รหัสแพ็กเกจ", style: "tableHeader" },
      { text: "ประเภท", style: "tableHeader" },
      { text: "แพ็กเกจ", style: "tableHeader" },
      { text: "จำนวน", style: "tableHeader" },
      { text: "QR", style: "tableHeader" },
    ],
    ...data.orders.flatMap((o, orderIndex) => 
      o.items.map((item, itemIndex) => [
        itemIndex === 0 ? String(orderIndex + 1) : "",
        itemIndex === 0 ? o.lineOrderNo : "",
        itemIndex === 0 ? o.lineOrderNo : "",
        itemIndex === 0 ? o.customerName : "",
        item.sku ?? "-",
        "ฝากใส่บาตร",
        getDisplayName(item.name ?? "-"),
        String(item.quantity ?? 0),
        { 
          qr: `${env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")}/staff/order/${o.lineOrderNo}`, 
          fit: 60, 
          eccLevel: 'H' 
        },
      ])
    ),
  ];

  // Group items into columns (max 4 items per column for layout aesthetic)
  interface SummaryItem {
    text: string;
    color?: string;
    fontSize?: number;
    bold?: boolean;
    margin?: number[];
  }
  interface SummaryColumn {
    stack: SummaryItem[];
  }
  const summaryColumns: [SummaryColumn, SummaryColumn] = [
    {
      stack: [
        { text: "วันดำเนินการ", color: "#6b7280", fontSize: 12 },
        { text: data.date, fontSize: 14, bold: true, margin: [0, 4, 0, 0] },
      ],
    },
    {
      stack: [
        { text: "ยอดที่ต้องโอน", color: "#6b7280", fontSize: 12 },
        { text: `฿${data.totalRevenue.toLocaleString()}`, fontSize: 14, bold: true, margin: [0, 4, 0, 0] },
      ],
    }
  ];

  // Distribute items across the 2 columns evenly
  summaryItems.forEach((item, index) => {
    const colIndex = index % 2 as 0 | 1;
    
    summaryColumns[colIndex].stack.push(
      { text: item.name, color: "#6b7280", fontSize: 12, margin: [0, 10, 0, 0] },
      { text: String(item.qty), fontSize: 14, bold: true, margin: [0, 4, 0, 0] }
    );
  });

  const docDefinition = {
    pageOrientation: "landscape",
    pageMargins: [10, 30, 10, 30],
    content: [
      {
        text: [
          { text: "สรุปออเดอร์", fontSize: 18, bold: true, color: "#7c3aed" },
        ],
        margin: [0, 0, 0, 20],
      },
      {
        columns: summaryColumns,
        margin: [0, 0, 0, 30],
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", 75, 75, "*", "auto", "auto", "*", "auto", "auto"],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#e5e7eb",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
    ],
    styles: {
      tableHeader: {
        fontSize: 12,
        bold: true,
        color: "#6b7280",
        fillColor: "#f9fafb",
      },
    },
    defaultStyle: {
      fontSize: 14,
      font: "THSarabunNew", // Set default to our Thai font
    },
  };

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  const doc = await printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));
      doc.end();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(err);
    }
  });
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
}

export function generateCsvString(data: ReportData): string {
  // UTF-8 BOM for Thai text Excel compatibility
  const bom = "\uFEFF";

  const headers = [
    "ลำดับ",
    "เลขที่คำสั่งซื้อ",
    "ชื่อลูกค้า",
    "สถานะ",
    "ยอดเงิน",
    "วันที่สั่งซื้อ",
  ];

  const rows = data.orders.map((o, i) =>
    [
      String(i + 1),
      o.lineOrderNo,
      `"${o.customerName}"`,
      o.internalStatus,
      Number(o.totalPrice).toFixed(2),
      o.orderDate,
    ].join(","),
  );

  return bom + [headers.join(","), ...rows].join("\n");
}
