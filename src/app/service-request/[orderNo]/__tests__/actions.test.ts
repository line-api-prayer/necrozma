// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyServiceRequestTokenMock: vi.fn(),
  singleMock: vi.fn(),
  selectEqMock: vi.fn(),
  selectMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("~/server/lib/service-request", () => ({
  verifyServiceRequestToken: mocks.verifyServiceRequestTokenMock,
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: mocks.fromMock,
  }),
}));

function buildFormData(overrides?: Partial<Record<string, string>>) {
  const formData = new FormData();
  formData.set("orderNo", overrides?.orderNo ?? "LINE-001");
  formData.set("token", overrides?.token ?? "signed-token");
  formData.set(
    "requestedServiceDate",
    overrides?.requestedServiceDate ?? "2026-03-21",
  );
  formData.set("prayerText", overrides?.prayerText ?? "  ขอให้สุขภาพแข็งแรง  ");
  return formData;
}

async function loadActions() {
  vi.resetModules();
  return import("../actions");
}

describe("submitServiceRequest", () => {
  beforeEach(() => {
    mocks.verifyServiceRequestTokenMock.mockReset();
    mocks.verifyServiceRequestTokenMock.mockReturnValue(true);
    mocks.singleMock.mockReset();
    mocks.selectEqMock.mockReset();
    mocks.selectMock.mockReset();
    mocks.updateEqMock.mockReset();
    mocks.updateMock.mockReset();
    mocks.fromMock.mockReset();

    mocks.selectEqMock.mockReturnValue({ single: mocks.singleMock });
    mocks.selectMock.mockReturnValue({ eq: mocks.selectEqMock });
    mocks.updateMock.mockReturnValue({ eq: mocks.updateEqMock });
    mocks.fromMock.mockReturnValue({
      select: mocks.selectMock,
      update: mocks.updateMock,
    });
  });

  it("persists a trimmed prayer text for pending orders", async () => {
    mocks.singleMock.mockResolvedValue({
      data: { id: "order-1", internal_status: "PENDING" },
      error: null,
    });
    mocks.updateEqMock.mockResolvedValue({ error: null });
    const { submitServiceRequest } = await loadActions();

    const result = await submitServiceRequest(
      { status: "idle", message: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      status: "success",
      message: "บันทึกวันดำเนินงานและคำขอพรเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ",
    });
    expect(mocks.verifyServiceRequestTokenMock).toHaveBeenCalledWith(
      "LINE-001",
      "signed-token",
    );
    const updateArg = mocks.updateMock.mock.calls[0]?.[0] as
      | {
          requested_service_date: string;
          prayer_text: string;
          service_request_completed_at: string;
          updated_at: string;
        }
      | undefined;
    expect(updateArg).toMatchObject({
      requested_service_date: "2026-03-21",
      prayer_text: "ขอให้สุขภาพแข็งแรง",
    });
    expect(typeof updateArg?.service_request_completed_at).toBe("string");
    expect(typeof updateArg?.updated_at).toBe("string");
    expect(mocks.updateEqMock).toHaveBeenCalledWith("id", "order-1");
  });

  it("rejects invalid links before touching the database", async () => {
    mocks.verifyServiceRequestTokenMock.mockReturnValue(false);
    const { submitServiceRequest } = await loadActions();

    const result = await submitServiceRequest(
      { status: "idle", message: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      status: "error",
      message:
        "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว รบกวนขอรับลิงก์ใหม่อีกครั้งนะคะ",
    });
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("rejects orders that are already in progress", async () => {
    mocks.singleMock.mockResolvedValue({
      data: { id: "order-1", internal_status: "APPROVED" },
      error: null,
    });
    const { submitServiceRequest } = await loadActions();

    const result = await submitServiceRequest(
      { status: "idle", message: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      status: "error",
      message:
        "คำสั่งซื้อนี้อยู่ในขั้นตอนดำเนินงานแล้ว จึงยังไม่สามารถแก้ไขข้อมูลได้ค่ะ หากต้องการความช่วยเหลือ รบกวนติดต่อเจ้าหน้าที่นะคะ",
    });
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });

  it("returns the database update error when persistence fails", async () => {
    mocks.singleMock.mockResolvedValue({
      data: { id: "order-1", internal_status: "PENDING" },
      error: null,
    });
    mocks.updateEqMock.mockResolvedValue({
      error: { message: "write failed" },
    });
    const { submitServiceRequest } = await loadActions();

    const result = await submitServiceRequest(
      { status: "idle", message: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "write failed",
    });
  });
});
