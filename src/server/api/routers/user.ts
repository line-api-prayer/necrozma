import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { pool } from "~/server/db/pg";
import { TRPCError } from "@trpc/server";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
}

export const userRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    const { rows } = await pool.query<UserRow>(
      'SELECT id, name, email, role, image FROM public.user ORDER BY "createdAt" DESC'
    );
    // Filter out current user from management list for safety
    return rows.filter((user) => user.id !== ctx.user.id);
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: z.enum(["admin", "user"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, name, role } = input;
      
      const updates: string[] = [];
      const values: (string | null | undefined)[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }

      if (updates.length === 0) return { success: true };

      values.push(id);
      const query = `UPDATE public.user SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id`;
      
      const { rowCount } = await pool.query(query, values);
      
      if (rowCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot delete yourself",
        });
      }

      const { rowCount } = await pool.query("DELETE FROM public.user WHERE id = $1", [input.id]);
      
      if (rowCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return { success: true };
    }),
});
