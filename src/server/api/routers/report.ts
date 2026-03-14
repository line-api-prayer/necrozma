import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";
import { supabaseClient } from "~/server/db/supabase";

export const reportRouter = createTRPCRouter({
  generate: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      // We still use generateAndSendDailySummary but return the URLs
      // The current shared function doesn't return URLs easily without sending
      // but let's keep it simple for now and just use the logic from daily-summary
      // or we can just call it with a fake admin UID if we don't want to send.
      
      // Actually, let's just use the shared logic by importing it
      await generateAndSendDailySummary(input.date);
      
      // The shared function already uploads to storage. 
      // We just need to get the URLs back.
      const supabase = await supabaseClient();
      const pdfPath = `${input.date}/daily-summary-${input.date}.pdf`;
      const csvPath = `${input.date}/daily-summary-${input.date}.csv`;
      
      const { data: pdfUrl } = supabase.storage.from("reports").getPublicUrl(pdfPath);
      const { data: csvUrl } = supabase.storage.from("reports").getPublicUrl(csvPath);
      
      const timestamp = Date.now();
      return {
        pdfUrl: `${pdfUrl.publicUrl}?v=${timestamp}`,
        csvUrl: `${csvUrl.publicUrl}?v=${timestamp}`,
      };
    }),

  sendToLine: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      return await generateAndSendDailySummary(input.date);
    }),
});
