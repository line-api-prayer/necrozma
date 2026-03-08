import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { markAsShip } from "~/server/lib/line/shop-client";
import {
  sendApprovalNotification,
  sendRejectionNotification,
} from "~/server/lib/line/messaging-client";

export const reviewRouter = createTRPCRouter({
  approve: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();

      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("line_order_no, customer_line_uid, customer_name, internal_status, total_price")
        .eq("id", input.orderId)
        .single();

      if (fetchError) throw new Error(fetchError.message);
      if (order.internal_status !== "UPLOADED") {
        throw new Error("Order must be in UPLOADED status to approve");
      }

      // Get evidence photo and video for the notification
      const { data: evidenceRows } = await supabase
        .from("evidence")
        .select("public_url, type")
        .eq("order_id", input.orderId)
        .in("type", ["photo", "video"]);

      const photoUrl = (evidenceRows?.find((r) => r.type === "photo") as { public_url: string } | undefined)
        ?.public_url;
      const videoUrl = (evidenceRows?.find((r) => r.type === "video") as { public_url: string } | undefined)
        ?.public_url;

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          internal_status: "COMPLETED",
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.orderId);

      if (updateError) throw new Error(updateError.message);

      // Mark as shipped on LINE Shop
      try {
        await markAsShip(order.line_order_no as string);
      } catch (e) {
        console.error("Failed to mark order as shipped on LINE Shop:", e);
      }

      // Send LINE push notification to customer
      if (order.customer_line_uid) {
        try {
          await sendApprovalNotification(
            order.customer_line_uid as string,
            {
              lineOrderNo: order.line_order_no as string,
              customerName: order.customer_name as string,
              totalPrice: Number(order.total_price),
            },
            photoUrl,
            videoUrl,
          );
        } catch (e) {
          console.error("Failed to send LINE approval notification:", e);
        }
      }

      return {
        success: true,
        customerName: order.customer_name as string,
        customerLineUid: order.customer_line_uid as string | null,
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

      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("internal_status, customer_line_uid, line_order_no, customer_name")
        .eq("id", input.orderId)
        .single();

      if (fetchError) throw new Error(fetchError.message);
      if (order.internal_status !== "UPLOADED") {
        throw new Error("Order must be in UPLOADED status to reject");
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          internal_status: "PENDING",
          rejection_reason: input.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.orderId);

      if (updateError) throw new Error(updateError.message);

      await supabase.from("evidence").delete().eq("order_id", input.orderId);

      // Send LINE push notification to customer
      if (order.customer_line_uid) {
        try {
          await sendRejectionNotification(
            order.customer_line_uid as string,
            {
              lineOrderNo: order.line_order_no as string,
              customerName: order.customer_name as string,
            },
            input.reason,
          );
        } catch (e) {
          console.error("Failed to send LINE rejection notification:", e);
        }
      }

      return { success: true };
    }),
});
