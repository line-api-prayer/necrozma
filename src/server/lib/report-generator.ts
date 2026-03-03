import { type OrderRow } from "~/server/lib/line/types";

interface ReportData {
  date: string;
  orders: OrderRow[];
  totalRevenue: number;
  pendingCount: number;
  uploadedCount: number;
  completedCount: number;
}

export async function generatePdfBuffer(data: ReportData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PdfPrinter = (
    require("pdfmake/js/Printer") as {
      default: new (fonts: Record<string, Record<string, string>>) => {
        createPdfKitDocument: (
          docDefinition: Record<string, unknown>,
        ) => NodeJS.ReadableStream & { end: () => void };
      };
    }
  ).default;

  const fonts = {
    Roboto: {
      normal: "node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf",
      bold: "node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf",
      italics: "node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf",
      bolditalics:
        "node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf",
    },
  };

  const printer = new PdfPrinter(fonts);

  const tableBody = [
    ["#", "Order No", "Customer", "Status", "Total"],
    ...data.orders.map((o, i) => [
      String(i + 1),
      o.line_order_no,
      o.customer_name,
      o.internal_status,
      `${Number(o.total_price).toLocaleString()}`,
    ]),
  ];

  const docDefinition = {
    content: [
      { text: `Daily Summary — ${data.date}`, style: "header" },
      { text: `Total Orders: ${data.orders.length}`, margin: [0, 10, 0, 0] },
      {
        text: `Total Revenue: ${data.totalRevenue.toLocaleString()} THB`,
        margin: [0, 5, 0, 0],
      },
      {
        text: `Pending: ${data.pendingCount} | Uploaded: ${data.uploadedCount} | Completed: ${data.completedCount}`,
        margin: [0, 5, 0, 15],
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "*", "auto", "auto"],
          body: tableBody,
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
    },
  };

  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
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
      o.line_order_no,
      `"${o.customer_name}"`,
      o.internal_status,
      Number(o.total_price).toFixed(2),
      o.order_date,
    ].join(","),
  );

  return bom + [headers.join(","), ...rows].join("\n");
}
