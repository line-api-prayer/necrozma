import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  generateCertificatePdfBuffer,
  type ReportData,
} from "../report-generator";

vi.mock("~/env.js", () => ({
  env: {
    BETTER_AUTH_URL: "https://example.com",
  },
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ original_name: "LONG_PACKAGE", display_name: "แพ็กเกจทดสอบ" }],
      }),
    }),
  }),
}));

const makeReportData = (): ReportData => ({
  date: "2026-03-15",
  totalRevenue: 1200,
  pendingCount: 2,
  uploadedCount: 0,
  completedCount: 0,
  items: [
    {
      name: "แพ็กเกจทดสอบ",
      qty: 3,
      total: 1200,
    },
  ],
  orderNumbers: ["2026031500000001", "2026031500000002"],
  orders: [
    {
      id: "order-1",
      lineOrderNo: "2026031500000001",
      lineStatus: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "card",
      internalStatus: "COMPLETED",
      customerName: "ลูกค้าทดสอบ หนึ่ง",
      customerLineUid: null,
      orderDate: "2026-03-15",
      checkoutAt: "2026-03-15T01:00:00.000Z",
      subtotalPrice: 400,
      shipmentPrice: 0,
      discountAmount: 0,
      totalPrice: 400,
      remarkBuyer: "ขอให้ครอบครัวมีความสุขและสุขภาพแข็งแรง",
      rejectionReason: null,
      syncedAt: "2026-03-15T01:00:00.000Z",
      createdAt: "2026-03-15T01:00:00.000Z",
      updatedAt: "2026-03-15T01:00:00.000Z",
      items: [
        {
          id: "item-1",
          orderId: "order-1",
          sku: "PKG-01",
          barcode: null,
          name: "LONG_PACKAGE",
          price: 400,
          discountedPrice: null,
          quantity: 1,
          imageUrl: null,
          variants: null,
          createdAt: "2026-03-15T01:00:00.000Z",
        },
      ],
      evidence: [],
    },
    {
      id: "order-2",
      lineOrderNo: "2026031500000002",
      lineStatus: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "card",
      internalStatus: "COMPLETED",
      customerName: "ลูกค้าทดสอบ สอง ที่มีชื่อค่อนข้างยาวเพื่อทดสอบการตัดบรรทัด",
      customerLineUid: null,
      orderDate: "2026-03-15",
      checkoutAt: "2026-03-15T02:00:00.000Z",
      subtotalPrice: 800,
      shipmentPrice: 0,
      discountAmount: 0,
      totalPrice: 800,
      remarkBuyer: null,
      rejectionReason: null,
      syncedAt: "2026-03-15T02:00:00.000Z",
      createdAt: "2026-03-15T02:00:00.000Z",
      updatedAt: "2026-03-15T02:00:00.000Z",
      items: [
        {
          id: "item-2",
          orderId: "order-2",
          sku: "PKG-02",
          barcode: null,
          name: "LONG_PACKAGE",
          price: 300,
          discountedPrice: null,
          quantity: 2,
          imageUrl: null,
          variants: null,
          createdAt: "2026-03-15T02:00:00.000Z",
        },
        {
          id: "item-3",
          orderId: "order-2",
          sku: "PKG-03",
          barcode: null,
          name: "ถวายสังฆทาน",
          price: 200,
          discountedPrice: null,
          quantity: 1,
          imageUrl: null,
          variants: null,
          createdAt: "2026-03-15T02:00:00.000Z",
        },
      ],
      evidence: [],
    },
  ],
});

describe("report-generator", () => {
  it("generates one certificate page per order", async () => {
    const buffer = await generateCertificatePdfBuffer(makeReportData());
    const pdf = await PDFDocument.load(new Uint8Array(buffer));

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(pdf.getPageCount()).toBe(2);
  });
});
