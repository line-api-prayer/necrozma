import fs from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-expect-error - pdfmake/js/Printer lacks a declaration file
import PdfPrinter from "pdfmake/js/Printer.js";
// @ts-expect-error - pdfmake/js/qrEnc lacks a declaration file
import qrEncoder from "pdfmake/js/qrEnc.js";
import { type OrderWithItems } from "~/server/lib/line/types";
import { supabaseClient } from "~/server/db/supabase";
import { getOrderDetailUrl } from "~/server/lib/app-links";

export interface ReportSummaryItem {
  name: string;
  qty: number;
  total: number;
}

export interface ReportData {
  date: string;
  orders: OrderWithItems[];
  totalRevenue: number;
  pendingCount: number;
  uploadedCount: number;
  completedCount: number;
  items?: ReportSummaryItem[];
  orderNumbers?: string[];
}

interface ProductMappingRow {
  original_name: string;
  display_name: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CertificateContent {
  name: string;
  details: string;
  place: string;
  packageText: string;
  orderNo: string;
  qrUrl: string;
}

interface QrCanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface QrMeasureResult {
  _canvas: QrCanvasRect[];
  _width: number;
}

interface QrEncoderModule {
  measure: (input: {
    qr: string;
    fit: number;
    padding: number;
    eccLevel: "H";
    foreground: string;
    background: string;
  }) => QrMeasureResult;
}

type PdfPrinterInstance = {
  createPdfKitDocument: (docDefinition: unknown) => Promise<PdfKitDocument>;
};

type PdfPrinterConstructor = new (
  fonts: ReturnType<typeof getPdfMakeFonts>,
  vfs?: unknown,
  options?: {
    resolve: (_url: string, _headers: Record<string, string>) => Promise<undefined>;
    resolved: () => Promise<undefined>;
  },
) => PdfPrinterInstance;

interface PdfKitDocument {
  on(event: "data", listener: (chunk: Buffer) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  end(): void;
}

const OUTLINE_PAGE_WIDTH = 566.93;
const OUTLINE_PAGE_HEIGHT = 396.85;
const TEMPLATE_PIXEL_WIDTH = 2363;
const TEMPLATE_PIXEL_HEIGHT = 1654;
const TEMPLATE_CM_WIDTH = 20;
const TEMPLATE_CM_HEIGHT = 14;
const DEFAULT_TEXT_COLOR = rgb(0, 0, 0);
const QR_FOREGROUND = rgb(0, 0, 0);
const QR_BACKGROUND = rgb(1, 1, 1);
const ORDER_DETAILS_PLACEHOLDER =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

function cmToPixelX(cm: number) {
  return (cm / TEMPLATE_CM_WIDTH) * TEMPLATE_PIXEL_WIDTH;
}

function cmToPixelY(cm: number) {
  return (cm / TEMPLATE_CM_HEIGHT) * TEMPLATE_PIXEL_HEIGHT;
}

function centeredBox(centerXcm: number, centerYcm: number, widthPx: number, heightPx: number): Box {
  return {
    x: cmToPixelX(centerXcm) - widthPx / 2,
    y: cmToPixelY(centerYcm) - heightPx / 2,
    width: widthPx,
    height: heightPx,
  };
}

const certificateBoxes = {
  qr: centeredBox(17.8831, 2.1169, cmToPixelX(3), cmToPixelY(3)),
  name: centeredBox(9.3985, 4.7233, 2202, 164),
  details: centeredBox(10, 8.6431, 2200, 309),
  place: centeredBox(3.682, 12.473, 693, 175),
  package: centeredBox(10, 12.473, 714, 175),
  orderNo: centeredBox(16.318, 12.473, 700, 175),
} satisfies Record<string, Box>;

function getFontsPath() {
  return path.resolve(process.cwd(), "public", "fonts");
}

function getFontFiles() {
  const fontsPath = getFontsPath();
  return {
    normal: path.join(fontsPath, "THSarabunNew.ttf"),
    bold: path.join(fontsPath, "THSarabunNew-Bold.ttf"),
    italics: path.join(fontsPath, "THSarabunNew-Italic.ttf"),
    bolditalics: path.join(fontsPath, "THSarabunNew-BoldItalic.ttf"),
  };
}

function getPdfMakeFonts() {
  const fontFiles = getFontFiles();
  return {
    Roboto: fontFiles,
    THSarabunNew: fontFiles,
  };
}

async function loadProductNameMap() {
  const supabase = await supabaseClient();
  const { data: mappingData } = await supabase
    .from("product_mappings")
    .select("original_name, display_name");
  const typedMappingData = (mappingData ?? []) as ProductMappingRow[];
  const nameMap = new Map<string, string>();
  typedMappingData.forEach((mapping) => {
    nameMap.set(mapping.original_name, mapping.display_name);
  });
  return nameMap;
}

function createDisplayNameResolver(nameMap: Map<string, string>) {
  return (name: string) => nameMap.get(name) ?? name;
}

function buildSummaryItems(data: ReportData, getDisplayName: (name: string) => string) {
  const summaryItems: ReportSummaryItem[] = [];

  data.orders.forEach((order) => {
    order.items.forEach((item) => {
      const displayName = getDisplayName(item.name);
      const existing = summaryItems.find((summaryItem) => summaryItem.name === displayName);
      if (existing) {
        existing.qty += item.quantity;
        existing.total += Number(item.price) * item.quantity;
        return;
      }

      summaryItems.push({
        name: displayName,
        qty: item.quantity,
        total: Number(item.price) * item.quantity,
      });
    });
  });

  return summaryItems;
}

function toPdfBox(box: Box): Box {
  const scaleX = OUTLINE_PAGE_WIDTH / TEMPLATE_PIXEL_WIDTH;
  const scaleY = OUTLINE_PAGE_HEIGHT / TEMPLATE_PIXEL_HEIGHT;

  return {
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

function stripText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitParagraphIntoLines(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  let lastBreakIndex = -1;
  let lastBreakLine = "";

  for (const char of Array.from(text)) {
    const next = current + char;
    const nextWidth = font.widthOfTextAtSize(next, fontSize);

    if (/\s/.test(char)) {
      lastBreakIndex = current.length;
      lastBreakLine = current;
    }

    if (nextWidth <= maxWidth) {
      current = next;
      continue;
    }

    const trimmedCurrent = stripText(current);
    if (trimmedCurrent.length > 0) {
      if (lastBreakIndex >= 0) {
        lines.push(stripText(lastBreakLine));
        const remaining = stripText(current.slice(lastBreakIndex));
        current = remaining.length > 0 ? `${remaining}${char}` : char.trimStart();
      } else {
        lines.push(trimmedCurrent);
        current = char.trimStart();
      }
    } else {
      current = char;
    }

    lastBreakIndex = -1;
    lastBreakLine = "";
  }

  const finalLine = stripText(current);
  if (finalLine.length > 0) {
    lines.push(finalLine);
  }

  return lines.length > 0 ? lines : [""];
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const normalized = text.replace(/\r\n/g, "\n");
  return normalized
    .split("\n")
    .flatMap((paragraph) => {
      const trimmed = stripText(paragraph);
      return trimmed.length > 0 ? splitParagraphIntoLines(trimmed, font, fontSize, maxWidth) : [""];
    });
}

function fitTextToBox(
  text: string,
  font: PDFFont,
  box: Box,
  maxFontSize: number,
  minFontSize: number,
  lineHeightMultiplier: number,
) {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lines = wrapText(text, font, fontSize, box.width);
    const lineHeight = fontSize * lineHeightMultiplier;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= box.height) {
      return { lines, fontSize, lineHeight };
    }
  }

  const fontSize = minFontSize;
  const lines = wrapText(text, font, fontSize, box.width);
  const lineHeight = fontSize * lineHeightMultiplier;
  const maxLines = Math.max(1, Math.floor(box.height / lineHeight));
  const fittedLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && fittedLines.length > 0) {
    const lastLine = fittedLines[fittedLines.length - 1] ?? "";
    const ellipsis = "...";
    let truncated = lastLine;
    while (
      truncated.length > 0 &&
      font.widthOfTextAtSize(`${truncated}${ellipsis}`, fontSize) > box.width
    ) {
      truncated = truncated.slice(0, -1);
    }
    fittedLines[fittedLines.length - 1] = `${truncated}${ellipsis}`;
  }

  return { lines: fittedLines, fontSize, lineHeight };
}

function drawTextBox(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: Box,
  options: {
    maxFontSize: number;
    minFontSize: number;
    lineHeightMultiplier: number;
    align?: "left" | "center";
    offsetY?: number;
    paddingX?: number;
  },
) {
  const normalizedBox = toPdfBox(box);
  const paddedBox = {
    ...normalizedBox,
    x: normalizedBox.x + (options.paddingX ?? 0),
    width: Math.max(0, normalizedBox.width - 2 * (options.paddingX ?? 0)),
  };
  const { lines, fontSize, lineHeight } = fitTextToBox(
    text,
    font,
    paddedBox,
    options.maxFontSize,
    options.minFontSize,
    options.lineHeightMultiplier,
  );

  const totalHeight = lines.length * lineHeight;
  const boxBottom = OUTLINE_PAGE_HEIGHT - normalizedBox.y - normalizedBox.height;
  let cursorY =
    boxBottom +
    (normalizedBox.height - totalHeight) / 2 +
    totalHeight -
    fontSize +
    (options.offsetY ?? 0);

  for (const line of lines) {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);
    const x =
      options.align === "left"
        ? paddedBox.x
        : paddedBox.x + Math.max(0, (paddedBox.width - lineWidth) / 2);

    page.drawText(line, {
      x,
      y: cursorY,
      size: fontSize,
      font,
      color: DEFAULT_TEXT_COLOR,
    });
    cursorY -= lineHeight;
  }
}

function drawQrCode(page: PDFPage, qrUrl: string, box: Box) {
  const typedQrEncoder = qrEncoder as unknown as QrEncoderModule;
  const qrNode = typedQrEncoder.measure({
    qr: qrUrl,
    fit: Math.floor(toPdfBox(box).width),
    padding: 0,
    eccLevel: "H",
    foreground: "#000",
    background: "#fff",
  });

  const qrBox = toPdfBox(box);
  const canvas = qrNode._canvas;
  const qrSize = qrNode._width;
  const offsetX = qrBox.x + (qrBox.width - qrSize) / 2;
  const offsetY = qrBox.y + (qrBox.height - qrSize) / 2;

  for (const rect of canvas) {
    page.drawRectangle({
      x: offsetX + rect.x,
      y: OUTLINE_PAGE_HEIGHT - offsetY - rect.y - rect.h,
      width: rect.w,
      height: rect.h,
      color: rect.color === "#fff" ? QR_BACKGROUND : QR_FOREGROUND,
      borderWidth: 0,
    });
  }
}

function summarizePackage(order: OrderWithItems, getDisplayName: (name: string) => string) {
  if (order.items.length === 0) {
    return "-";
  }

  const firstItem = order.items[0];
  if (!firstItem) {
    return "-";
  }
  const remainingItems = order.items.slice(1);
  const firstLabel = `${getDisplayName(firstItem.name)} x${firstItem.quantity}`;
  return remainingItems.length === 0 ? firstLabel : `${firstLabel} +${remainingItems.length}`;
}

function buildDetailText(order: OrderWithItems) {
  const details: string[] = [];
  if (stripText(order.prayerText ?? "").length > 0) {
    details.push(stripText(order.prayerText ?? ""));
  } else if (stripText(order.remarkBuyer ?? "").length > 0) {
    details.push(stripText(order.remarkBuyer ?? ""));
  }

  if (details.length === 0) {
    details.push(ORDER_DETAILS_PLACEHOLDER);
  }

  return details.join("\n\n");
}

function buildCertificateContent(order: OrderWithItems, getDisplayName: (name: string) => string): CertificateContent {
  return {
    name: stripText(order.customerName || "ไม่ระบุชื่อ"),
    details: buildDetailText(order),
    place: "",
    packageText: summarizePackage(order, getDisplayName),
    orderNo: order.lineOrderNo,
    qrUrl: getOrderDetailUrl(order.lineOrderNo),
  };
}

function createPdfPrinter(): PdfPrinterInstance {
  const fontFiles = getFontFiles();
  console.log(`[PDF] Loading fonts from: ${getFontsPath()}`);
  for (const [key, filePath] of Object.entries(fontFiles)) {
    if (!fs.existsSync(filePath)) {
      console.error(`[PDF] Missing font file for ${key}: ${filePath}`);
    }
  }

  // pdfmake 0.3 expects a URL resolver even when using absolute local file paths.
  const TypedPdfPrinter = PdfPrinter as unknown as PdfPrinterConstructor;
  return new TypedPdfPrinter(getPdfMakeFonts(), undefined, {
    resolve: async (_url: string, _headers: Record<string, string>) => undefined,
    resolved: async () => undefined,
  });
}

export async function generatePdfBuffer(data: ReportData): Promise<Buffer> {
  const printer = createPdfPrinter();
  const nameMap = await loadProductNameMap();
  const getDisplayName = createDisplayNameResolver(nameMap);
  const summaryItems = data.items ?? buildSummaryItems(data, getDisplayName);

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
    ...data.orders.flatMap((order, orderIndex) =>
      order.items.map((item, itemIndex) => [
        itemIndex === 0 ? String(orderIndex + 1) : "",
        itemIndex === 0 ? order.lineOrderNo : "",
        itemIndex === 0 ? order.lineOrderNo : "",
        itemIndex === 0 ? order.customerName : "",
        item.sku ?? "-",
        "ฝากใส่บาตร",
        getDisplayName(item.name ?? "-"),
        String(item.quantity ?? 0),
        {
          qr: getOrderDetailUrl(order.lineOrderNo),
          fit: 60,
          eccLevel: "H",
        },
      ]),
    ),
  ];

  interface SummaryTextItem {
    text: string;
    color?: string;
    fontSize?: number;
    bold?: boolean;
    margin?: number[];
  }

  interface SummaryColumn {
    stack: SummaryTextItem[];
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
        {
          text: `฿${data.totalRevenue.toLocaleString()}`,
          fontSize: 14,
          bold: true,
          margin: [0, 4, 0, 0],
        },
      ],
    },
  ];

  summaryItems.forEach((item, index) => {
    const columnIndex = index % 2 as 0 | 1;
    summaryColumns[columnIndex].stack.push(
      { text: item.name, color: "#6b7280", fontSize: 12, margin: [0, 10, 0, 0] },
      { text: String(item.qty), fontSize: 14, bold: true, margin: [0, 4, 0, 0] },
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    pageOrientation: "landscape",
    pageMargins: [10, 30, 10, 30],
    content: [
      {
        text: [{ text: "สรุปออเดอร์", fontSize: 18, bold: true, color: "#7c3aed" }],
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
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === node.table.body.length ? 1 : 0.5,
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
      font: "THSarabunNew",
    },
  };

  const doc = await printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function generateCertificatePdfBuffer(data: ReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const normalFontBytes = new Uint8Array(fs.readFileSync(getFontFiles().normal));
  const boldFontBytes = new Uint8Array(fs.readFileSync(getFontFiles().bold));
  const templateBytes = new Uint8Array(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/server/lib/report-assets/SaibahtOnline-Template.png",
      ),
    ),
  );
  const nameMap = await loadProductNameMap();
  const getDisplayName = createDisplayNameResolver(nameMap);

  const normalFont = await pdfDoc.embedFont(normalFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);
  const templateImage = await pdfDoc.embedPng(templateBytes);

  const renderPage = (content: CertificateContent) => {
    const page = pdfDoc.addPage([OUTLINE_PAGE_WIDTH, OUTLINE_PAGE_HEIGHT]);
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: OUTLINE_PAGE_WIDTH,
      height: OUTLINE_PAGE_HEIGHT,
    });

    drawQrCode(page, content.qrUrl, certificateBoxes.qr);
    drawTextBox(page, boldFont, content.name, certificateBoxes.name, {
      maxFontSize: 24,
      minFontSize: 14,
      lineHeightMultiplier: 1.05,
      offsetY: 3,
    });
    drawTextBox(page, normalFont, content.details, certificateBoxes.details, {
      maxFontSize: 19,
      minFontSize: 10,
      lineHeightMultiplier: 1.15,
      align: "left",
      paddingX: 18,
    });
    drawTextBox(page, boldFont, content.place || "-", certificateBoxes.place, {
      maxFontSize: 20,
      minFontSize: 12,
      lineHeightMultiplier: 1.05,
    });
    drawTextBox(page, boldFont, content.packageText, certificateBoxes.package, {
      maxFontSize: 19,
      minFontSize: 11,
      lineHeightMultiplier: 1.05,
      offsetY: 3,
    });
    drawTextBox(page, boldFont, content.orderNo, certificateBoxes.orderNo, {
      maxFontSize: 20,
      minFontSize: 11,
      lineHeightMultiplier: 1.05,
      offsetY: 3,
    });
  };

  if (data.orders.length === 0) {
    renderPage({
      name: "ไม่มีออเดอร์ประจำวัน",
      details: `ไม่พบออเดอร์สำหรับวันที่ ${data.date}`,
      place: "-",
      packageText: "-",
      orderNo: "-",
      qrUrl: getOrderDetailUrl("-"),
    });
  } else {
    data.orders.forEach((order) => {
      renderPage(buildCertificateContent(order, getDisplayName));
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export function generateCsvString(data: ReportData): string {
  const bom = "\uFEFF";
  const headers = [
    "ลำดับ",
    "เลขที่คำสั่งซื้อ",
    "ชื่อลูกค้า",
    "สถานะ",
    "ยอดเงิน",
    "วันที่สั่งซื้อ",
  ];

  const rows = data.orders.map((order, index) =>
    [
      String(index + 1),
      order.lineOrderNo,
      `"${order.customerName}"`,
      order.internalStatus,
      Number(order.totalPrice).toFixed(2),
      order.orderDate,
    ].join(","),
  );

  return bom + [headers.join(","), ...rows].join("\n");
}
