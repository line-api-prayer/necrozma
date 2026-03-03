import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";

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
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            internal_status: "UPLOADED",
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.orderId);

        if (updateError) throw new Error(updateError.message);
      }

      return { success: true, publicUrl: urlData.publicUrl };
    }),
});
