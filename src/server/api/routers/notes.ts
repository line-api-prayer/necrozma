import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";

export const notesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async () => {
    const supabase = await supabaseClient();
    const { data: notes, error } = await supabase.from("notes").select("*");

    if (error) {
      console.error("Error fetching notes:", error);
      throw new Error(error.message);
    }

    return notes;
  }),
});

