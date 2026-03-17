import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewRouter } from "../review";

const mocks = vi.hoisted(() => ({
  markAsShipMock: vi.fn(),
  sendApprovalNotificationMock: vi.fn(),
  sendRejectionNotificationMock: vi.fn(),
  poolQueryMock: vi.fn(),
  evidenceDeleteEqMock: vi.fn().mockResolvedValue({ error: null }),
  evidenceDeleteMock: vi.fn(),
  evidenceSingleMock: vi.fn(),
  evidenceSelectMock: vi.fn(),
  ordersSingleMock: vi.fn(),
  ordersSelectMock: vi.fn(),
  ordersUpdateEqMock: vi.fn().mockResolvedValue({ error: null }),
  ordersUpdateMock: vi.fn(),
  fromMock: vi.fn(),
  env: {
    ENABLE_TEST_MODE: "false",
    DEV_TEST_USER_ID: undefined,
  },
}));

mocks.evidenceDeleteMock.mockImplementation(() => ({
  eq: mocks.evidenceDeleteEqMock,
}));
mocks.ordersUpdateMock.mockImplementation(() => ({
  eq: mocks.ordersUpdateEqMock,
}));
mocks.ordersSelectMock.mockImplementation(() => ({
  eq: vi.fn(() => ({
    single: mocks.ordersSingleMock,
  })),
}));
mocks.evidenceSelectMock.mockImplementation((columns: string) => {
  if (columns === "public_url, type") {
    return {
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: [{ type: "photo", public_url: "https://example.com/photo.jpg" }],
          error: null,
        }),
      })),
    };
  }

  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: mocks.evidenceSingleMock,
      })),
    })),
  };
});
mocks.fromMock.mockImplementation((table: string) => {
  if (table === "orders") {
    return {
      select: mocks.ordersSelectMock,
      update: mocks.ordersUpdateMock,
    };
  }

  if (table === "evidence") {
    return {
      select: mocks.evidenceSelectMock,
      delete: mocks.evidenceDeleteMock,
    };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: mocks.fromMock,
  }),
}));

vi.mock("~/server/lib/line/shop-client", () => ({
  markAsShip: mocks.markAsShipMock,
}));

vi.mock("~/server/lib/line/messaging-client", () => ({
  sendApprovalNotification: mocks.sendApprovalNotificationMock,
  sendRejectionNotification: mocks.sendRejectionNotificationMock,
}));

vi.mock("~/server/db/pg", () => ({
  pool: {
    query: mocks.poolQueryMock,
  },
}));

vi.mock("~/server/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

function createCaller() {
  return reviewRouter.createCaller({
    headers: new Headers(),
    session: {
      user: {
        id: "admin-1",
        role: "admin",
        banned: false,
      },
    },
  } as never);
}

describe("review router", () => {
  beforeEach(() => {
    mocks.markAsShipMock.mockReset();
    mocks.sendApprovalNotificationMock.mockReset();
    mocks.sendRejectionNotificationMock.mockReset();
    mocks.poolQueryMock.mockReset();
    mocks.poolQueryMock.mockResolvedValue({ rowCount: 1 });
    mocks.ordersUpdateEqMock.mockReset();
    mocks.ordersUpdateEqMock.mockResolvedValue({ error: null });
    mocks.evidenceDeleteEqMock.mockReset();
    mocks.evidenceDeleteEqMock.mockResolvedValue({ error: null });
    mocks.evidenceSingleMock.mockReset();
    mocks.evidenceSingleMock.mockResolvedValue({
      data: { uploaded_by: "staff-1" },
      error: null,
    });
    mocks.ordersSingleMock.mockReset();
    mocks.ordersSingleMock.mockResolvedValue({
      data: {
        line_order_no: "LINE-001",
        customer_line_uid: "U-customer",
        customer_name: "Jane Doe",
        internal_status: "UPLOADED",
        total_price: 100,
      },
      error: null,
    });
  });

  it("continues approval when the staff notification insert fails", async () => {
    mocks.poolQueryMock.mockRejectedValue(new Error("notification insert failed"));

    const result = await createCaller().approve({ orderId: "550e8400-e29b-41d4-a716-446655440000" });

    expect(result.success).toBe(true);
    expect(mocks.markAsShipMock).toHaveBeenCalledWith("LINE-001");
    expect(mocks.sendApprovalNotificationMock).toHaveBeenCalled();
  });

  it("fails rejection when deleting evidence fails", async () => {
    mocks.evidenceDeleteEqMock.mockResolvedValue({
      error: { message: "delete failed" },
    });

    await expect(
      createCaller().reject({
        orderId: "550e8400-e29b-41d4-a716-446655440000",
        reason: "missing proof",
      }),
    ).rejects.toThrow("delete failed");
  });
});
