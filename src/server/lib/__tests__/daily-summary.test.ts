import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAndSendDailySummary, generateDailySummary } from "../daily-summary";

const mocks = vi.hoisted(() => ({
  generatePdfBufferMock: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  generateCertificatePdfBufferMock: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
  sendDailySummaryToAdminMock: vi.fn().mockResolvedValue(undefined),
  getStaffDashboardUrlMock: vi.fn().mockReturnValue("https://example.com/staff?date=2026-03-16"),
  ordersSelectMock: vi.fn(),
  productMappingsSelectMock: vi.fn(),
  orderItemsInMock: vi.fn(),
  evidenceInMock: vi.fn(),
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  fromMock: vi.fn(),
}));

const ordersData = [
  {
    id: "order-1",
    line_order_no: "LINE-001",
    requested_service_date: "2026-03-16",
    internal_status: "PENDING",
    total_price: 100,
    customer_name: "Jane Doe",
    line_status: "FINALIZED",
    payment_status: "PAID",
    payment_method: "CARD",
    order_date: "2026-03-15",
    checkout_at: "2026-03-15T10:00:00.000Z",
    subtotal_price: 100,
    shipment_price: 0,
    discount_amount: 0,
    remark_buyer: null,
    synced_at: "2026-03-15T10:00:00.000Z",
    created_at: "2026-03-15T10:00:00.000Z",
    updated_at: "2026-03-15T10:00:00.000Z",
    customer_line_uid: "U-1",
    rejection_reason: null,
  },
];

function buildSupabaseMock() {
  return {
    from: mocks.fromMock,
    storage: {
      from: vi.fn(() => ({
        upload: mocks.uploadMock,
        getPublicUrl: mocks.getPublicUrlMock,
      })),
    },
  };
}

mocks.fromMock.mockImplementation((table: string) => {
  if (table === "orders") {
    return {
      select: mocks.ordersSelectMock,
    };
  }

  if (table === "product_mappings") {
    return {
      select: mocks.productMappingsSelectMock,
    };
  }

  if (table === "order_items") {
    return {
      select: vi.fn(() => ({
        in: mocks.orderItemsInMock,
      })),
    };
  }

  if (table === "evidence") {
    return {
      select: vi.fn(() => ({
        in: mocks.evidenceInMock,
      })),
    };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("~/env.js", () => ({
  env: {
    ADMIN_LINE_UID: ["U-admin-1", "U-admin-2"],
  },
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockImplementation(() => buildSupabaseMock()),
}));

vi.mock("~/server/lib/report-generator", () => ({
  generatePdfBuffer: mocks.generatePdfBufferMock,
  generateCertificatePdfBuffer: mocks.generateCertificatePdfBufferMock,
}));

vi.mock("~/server/lib/app-links", () => ({
  getStaffDashboardUrl: mocks.getStaffDashboardUrlMock,
}));

vi.mock("~/server/lib/line/messaging-client", () => ({
  sendDailySummaryToAdmin: mocks.sendDailySummaryToAdminMock,
}));

describe("daily-summary", () => {
  beforeEach(() => {
    mocks.ordersSelectMock.mockReset();
    mocks.productMappingsSelectMock.mockReset();
    mocks.orderItemsInMock.mockReset();
    mocks.evidenceInMock.mockReset();
    mocks.uploadMock.mockReset();
    mocks.getPublicUrlMock.mockReset();
    mocks.sendDailySummaryToAdminMock.mockReset();

    mocks.ordersSelectMock.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: ordersData, error: null }),
      }),
    });
    mocks.productMappingsSelectMock.mockResolvedValue({ data: [], error: null });
    mocks.orderItemsInMock.mockResolvedValue({ data: [], error: null });
    mocks.evidenceInMock.mockResolvedValue({ data: [], error: null });
    mocks.uploadMock.mockResolvedValue({ error: null });
    mocks.getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://example.com/report.pdf" } });
    mocks.sendDailySummaryToAdminMock.mockResolvedValue(undefined);
  });

  it("throws when fetching order items fails", async () => {
    mocks.orderItemsInMock.mockResolvedValue({
      data: null,
      error: { message: "items failed" },
    });

    await expect(generateDailySummary("2026-03-16")).rejects.toThrow("items failed");
  });

  it("throws when uploading the summary PDF fails", async () => {
    mocks.uploadMock
      .mockResolvedValueOnce({ error: { message: "summary upload failed" } })
      .mockResolvedValueOnce({ error: null });

    await expect(generateDailySummary("2026-03-16")).rejects.toThrow("summary upload failed");
  });

  it("continues sending summaries even if one admin delivery fails", async () => {
    mocks.sendDailySummaryToAdminMock
      .mockRejectedValueOnce(new Error("LINE push failed"))
      .mockResolvedValueOnce(undefined);

    const result = await generateAndSendDailySummary("2026-03-16");

    expect(result.ok).toBe(true);
    expect(mocks.sendDailySummaryToAdminMock).toHaveBeenCalledTimes(2);
  });
});
