import { postRouter } from "~/server/api/routers/post";
import { notesRouter } from "~/server/api/routers/notes";
import { orderRouter } from "~/server/api/routers/order";
import { reviewRouter } from "~/server/api/routers/review";
import { evidenceRouter } from "~/server/api/routers/evidence";
import { reportRouter } from "~/server/api/routers/report";
import { mappingRouter } from "~/server/api/routers/mapping";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  notes: notesRouter,
  order: orderRouter,
  review: reviewRouter,
  evidence: evidenceRouter,
  report: reportRouter,
  mapping: mappingRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
