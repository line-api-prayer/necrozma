import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { generateAndSendDailySummary, generateDailySummary } from "~/server/lib/daily-summary";

export const reportRouter = createTRPCRouter({
  generate: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      const result = await generateDailySummary(input.date);
      return {
        pdfUrl: result.pdfUrl,
        certificatePdfUrl: result.certificatePdfUrl,
        dashboardUrl: result.dashboardUrl,
      };
    }),

  sendToLine: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      return await generateAndSendDailySummary(input.date);
    }),
});
