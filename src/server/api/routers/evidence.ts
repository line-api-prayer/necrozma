import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { adminClient } from "~/server/lib/line/messaging-client";
import { env } from "~/env.js";

export const evidenceRouter = createTRPCRouter({
  getUploadUrl: staffProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        type: z.enum(["photo", "video"]),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      const ext = input.type === "photo" ? "jpg" : "mp4";
      const path = `${input.orderId}/${input.type}_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("evidence")
        .createSignedUploadUrl(path);

      if (error) throw new Error(error.message);

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        path,
      };
    }),

  confirmUpload: staffProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        type: z.enum(["photo", "video"]),
        storagePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = await supabaseClient();

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("evidence")
        .getPublicUrl(input.storagePath);

      // Create evidence record
      const { error: insertError } = await supabase.from("evidence").insert({
        order_id: input.orderId,
        type: input.type,
        storage_path: input.storagePath,
        public_url: urlData.publicUrl,
        uploaded_by: ctx.user.id,
      });

      if (insertError) throw new Error(insertError.message);

      // If this is a photo upload, set order status to UPLOADED
      if (input.type === "photo") {
        const { data: orderData, error: updateError } = await supabase
          .from("orders")
          .update({
            internal_status: "UPLOADED",
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.orderId)
          .select("line_order_no, customer_name")
          .single();

        if (updateError) throw new Error(updateError.message);

        // Notify Admins that a new proof is ready for review
        if (env.ADMIN_LINE_UID && env.ADMIN_LINE_UID.length > 0) {
          for (const adminId of env.ADMIN_LINE_UID) {
            try {
              await adminClient.pushMessage({
                to: adminId,
                messages: [
                  {
                    type: "text",
                    text: `🔔 มีหลักฐานใหม่ถูกอัพโหลดโดยพนักงาน\nคำสั่งซื้อ: ${orderData.line_order_no}\nลูกค้า: ${orderData.customer_name}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบและอนุมัติ`,
                  },
                ],
              });
            } catch (e) {
              console.error(`Failed to notify admin ${adminId} of new proof upload:`, e);
            }
          }
        }
      }

      return { success: true, publicUrl: urlData.publicUrl };
    }),
});
