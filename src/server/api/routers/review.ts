import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { markAsShip } from "~/server/lib/line/shop-client";
import {
  sendApprovalNotification,
  sendRejectionNotification,
} from "~/server/lib/line/messaging-client";
import { env } from "~/env.js";
import { pool } from "~/server/db/pg";
import { createLogger, serializeError } from "~/server/lib/logger";

const logger = createLogger("review-router");

type ReviewOrderRow = {
  line_order_no: string;
  customer_line_uid: string | null;
  customer_name: string;
  internal_status: string;
  total_price?: number | string | null;
};

type EvidenceAssetRow = {
  public_url: string;
  type: string;
};

type EvidenceUploadRow = {
  uploaded_by: string | null;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export const reviewRouter = createTRPCRouter({
  approve: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      logger.info("review.approve.started", {
        orderId: input.orderId,
      });

      const orderResult = await supabase
        .from("orders")
        .select("line_order_no, customer_line_uid, customer_name, internal_status, total_price")
        .eq("id", input.orderId)
        .single() as QueryResult<ReviewOrderRow>;

      const { data: typedOrder, error: fetchError } = orderResult;
      if (fetchError) throw new Error(fetchError.message);
      if (!typedOrder) throw new Error("Order not found");
      if (typedOrder.internal_status !== "UPLOADED") {
        logger.warn("review.approve.invalid_status", {
          orderId: input.orderId,
          internalStatus: typedOrder.internal_status,
        });
        throw new Error("Order must be in UPLOADED status to approve");
      }

      // Get evidence photo and video for the notification
      const evidenceResult = await supabase
        .from("evidence")
        .select("public_url, type")
        .eq("order_id", input.orderId)
        .in("type", ["photo", "video"]) as QueryResult<EvidenceAssetRow[]>;

      const { data: evidenceRows, error: evidenceFetchError } = evidenceResult;
      const typedEvidenceRows = evidenceRows ?? [];

      if (evidenceFetchError) {
        logger.warn("review.approve.evidence_fetch_failed", {
          orderId: input.orderId,
          error: serializeError(evidenceFetchError),
        });
      }

      const photoUrl = typedEvidenceRows.find((r) => r.type === "photo")?.public_url;
      const videoUrl = typedEvidenceRows.find((r) => r.type === "video")?.public_url;

      const updateResult = await supabase
        .from("orders")
        .update({
          internal_status: "COMPLETED",
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.orderId) as QueryResult<null>;

      const { error: updateError } = updateResult;

      if (updateError) throw new Error(updateError.message);

      // Notify the staff who uploaded the evidence
      const uploadInfoResult = await supabase
        .from("evidence")
        .select("uploaded_by")
        .eq("order_id", input.orderId)
        .eq("type", "photo")
        .single() as QueryResult<EvidenceUploadRow>;

      const { data: typedUploadInfo } = uploadInfoResult;

      if (typedUploadInfo?.uploaded_by) {
        try {
          await pool.query(
            "INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)",
            [
              typedUploadInfo.uploaded_by,
              "✅ อนุมัติหลักฐานเรียบร้อย",
              `คำสั่งซื้อ ${typedOrder.line_order_no} ได้รับการอนุมัติแล้ว`,
              "success",
              `/staff`,
            ]
          );
        } catch (error) {
          logger.error("review.approve.staff_notification_failed", {
            orderId: input.orderId,
            uploadedBy: typedUploadInfo.uploaded_by,
            error: serializeError(error),
          });
        }
      }

      // Mark as shipped on LINE Shop
      try {
        await markAsShip(typedOrder.line_order_no);
      } catch (e) {
        logger.error("review.approve.mark_as_ship_failed", {
          orderId: input.orderId,
          orderNo: typedOrder.line_order_no,
          error: serializeError(e),
        });
      }

      // Send LINE push notification to customer
      if (typedOrder.customer_line_uid || (env.ENABLE_TEST_MODE === "true" && env.DEV_TEST_USER_ID)) {
        try {
          await sendApprovalNotification(
            typedOrder.customer_line_uid ?? "test-uid",
            {
              lineOrderNo: typedOrder.line_order_no,
              customerName: typedOrder.customer_name,
              totalPrice: Number(typedOrder.total_price),
            },
            photoUrl,
            videoUrl,
          );
        } catch (e) {
          logger.error("review.approve.customer_notification_failed", {
            orderId: input.orderId,
            orderNo: typedOrder.line_order_no,
            error: serializeError(e),
          });
        }
      }

      logger.info("review.approve.completed", {
        orderId: input.orderId,
        orderNo: typedOrder.line_order_no,
      });

      return {
        success: true,
        customerName: typedOrder.customer_name,
        customerLineUid: typedOrder.customer_line_uid,
      };
    }),

  reject: adminProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      logger.info("review.reject.started", {
        orderId: input.orderId,
      });

      const orderResult = await supabase
        .from("orders")
        .select("internal_status, customer_line_uid, line_order_no, customer_name")
        .eq("id", input.orderId)
        .single() as QueryResult<ReviewOrderRow>;

      const { data: typedOrder, error: fetchError } = orderResult;
      if (fetchError) throw new Error(fetchError.message);
      if (!typedOrder) throw new Error("Order not found");
      if (typedOrder.internal_status !== "UPLOADED") {
        logger.warn("review.reject.invalid_status", {
          orderId: input.orderId,
          internalStatus: typedOrder.internal_status,
        });
        throw new Error("Order must be in UPLOADED status to reject");
      }

      const updateResult = await supabase
        .from("orders")
        .update({
          internal_status: "PENDING",
          rejection_reason: input.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.orderId) as QueryResult<null>;

      const { error: updateError } = updateResult;

      if (updateError) throw new Error(updateError.message);

      // Notify the staff who uploaded the evidence before deleting it
      const uploadInfoResult = await supabase
        .from("evidence")
        .select("uploaded_by")
        .eq("order_id", input.orderId)
        .eq("type", "photo")
        .single() as QueryResult<EvidenceUploadRow>;

      const { data: typedUploadInfo } = uploadInfoResult;

      if (typedUploadInfo?.uploaded_by) {
        try {
          await pool.query(
            "INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)",
            [
              typedUploadInfo.uploaded_by,
              "❌ หลักฐานถูกส่งกลับแก้ไข",
              `คำสั่งซื้อ ${typedOrder.line_order_no} ถูกปฏิเสธ: ${input.reason}`,
              "error",
              `/staff/order/${typedOrder.line_order_no}`,
            ]
          );
        } catch (error) {
          logger.error("review.reject.staff_notification_failed", {
            orderId: input.orderId,
            uploadedBy: typedUploadInfo.uploaded_by,
            error: serializeError(error),
          });
        }
      }

      const deleteEvidenceResult = await supabase.from("evidence").delete().eq("order_id", input.orderId) as QueryResult<null>;
      const { error: deleteEvidenceError } = deleteEvidenceResult;
      if (deleteEvidenceError) {
        logger.error("review.reject.evidence_delete_failed", {
          orderId: input.orderId,
          error: serializeError(deleteEvidenceError),
        });
        throw new Error(deleteEvidenceError.message);
      }

      // Send LINE push notification to customer
      if (typedOrder.customer_line_uid || (env.ENABLE_TEST_MODE === "true" && env.DEV_TEST_USER_ID)) {
        try {
          await sendRejectionNotification(
            typedOrder.customer_line_uid ?? "test-uid",
            {
              lineOrderNo: typedOrder.line_order_no,
              customerName: typedOrder.customer_name,
            },
            input.reason,
          );
        } catch (e) {
          logger.error("review.reject.customer_notification_failed", {
            orderId: input.orderId,
            orderNo: typedOrder.line_order_no,
            error: serializeError(e),
          });
        }
      }

      logger.info("review.reject.completed", {
        orderId: input.orderId,
        orderNo: typedOrder.line_order_no,
      });

      return { success: true };
    }),
});
