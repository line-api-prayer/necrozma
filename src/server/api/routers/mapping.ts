import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";

export const mappingRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from("product_mappings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  }),

  upsert: publicProcedure
    .input(
      z.object({
        originalName: z.string().min(1),
        displayName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      const { data, error } = await supabase
        .from("product_mappings")
        .upsert(
          {
            original_name: input.originalName,
            display_name: input.displayName,
          },
          { onConflict: "original_name" }
        )
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      const { error } = await supabase
        .from("product_mappings")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    }),
});
