/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendApprovalNotification,
  sendRejectionNotification,
} from "../messaging-client";

const { pushMessageMock, broadcastMock } = vi.hoisted(() => ({
  pushMessageMock: vi.fn().mockResolvedValue({}),
  broadcastMock: vi.fn().mockResolvedValue({}),
}));

// Mock the LINE SDK so no actual requests are sent
vi.mock("@line/bot-sdk", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    messagingApi: {
      ...actual.messagingApi,
      MessagingApiClient: class {
        pushMessage = pushMessageMock;
        broadcast = broadcastMock;
      },
    },
  };
});

// We need to mock environment variables internally so DEV_TEST_USER_ID overrides target or not.
vi.mock("~/env.js", () => ({
  env: {
    ENABLE_TEST_MODE: "true",
    DEV_TEST_USER_ID: "Utest-override-123",
    LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN: "mock-token",
    LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN: "mock-admin-token",
  },
}));

describe("messaging-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  it("should send an approval Flex Message & push a VideoMessage if videoUrl is supplied", async () => {
    const mockOrder = {
      lineOrderNo: "TEST-001",
      customerName: "Jane Doe",
      totalPrice: 1500,
    };

    await sendApprovalNotification(
      "U-original-customer",
      mockOrder,
      "https://example.com/photo.jpg",
      "https://example.com/video.mp4"
    );

    expect(pushMessageMock).toHaveBeenCalledTimes(1);
    
    // Assert intercepting the actual argument
    const pushArgs = pushMessageMock.mock.calls[0]?.[0] as any;
    
    // Should override to the DEV test id
    expect(pushArgs?.to).toBe("Utest-override-123");
    
    // Expect 2 messages: flex and video
    expect(pushArgs?.messages).toHaveLength(2);
    
    // Check flex message
    expect(pushArgs?.messages[0]?.type).toBe("flex");
    
    // Check video message
    expect(pushArgs?.messages[1]).toEqual({
      type: "video",
      originalContentUrl: "https://example.com/video.mp4",
      previewImageUrl: "https://example.com/photo.jpg",
    });
  });

  it("should send a rejection reason successfully", async () => {
    const mockOrder = {
      lineOrderNo: "TEST-002",
      customerName: "John Doe",
    };

    await sendRejectionNotification(
      "U-original-customer",
      mockOrder,
      "Missing name in video"
    );

    expect(pushMessageMock).toHaveBeenCalledTimes(1);
    const pushArgs = pushMessageMock.mock.calls[0]?.[0] as any;
    
    expect(pushArgs?.to).toBe("Utest-override-123");
    expect(pushArgs?.messages).toHaveLength(1);
    expect(pushArgs?.messages[0]?.type).toBe("text");
    
    // Should include the custom reason
    expect(pushArgs?.messages[0]?.text).toContain("Missing name in video");
  });
});
