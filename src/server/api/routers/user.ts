import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { pool } from "~/server/db/pg";
import { TRPCError } from "@trpc/server";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  banned: boolean | null;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export const userRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    const { rows } = await pool.query<UserRow>(
      'SELECT id, name, email, role, image, banned FROM public.user ORDER BY "createdAt" DESC'
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
        banned: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, name, role, banned } = input;
      
      const updates: string[] = [];
      const values: (string | null | undefined | boolean)[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }
      if (banned !== undefined) {
        updates.push(`banned = $${paramCount++}`);
        values.push(banned);
        if (!banned) {
          updates.push(`"banReason" = NULL`);
        }
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

  notifications: protectedProcedure.query(async ({ ctx }) => {
    const { rows } = await pool.query<NotificationRow>(
      "SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [ctx.user.id]
    );
    return rows;
  }),

  markNotificationRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await pool.query(
        "UPDATE public.notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        [input.id, ctx.user.id]
      );
      return { success: true };
    }),

  markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await pool.query(
      "UPDATE public.notifications SET is_read = TRUE WHERE user_id = $1",
      [ctx.user.id]
    );
    return { success: true };
  }),
});
