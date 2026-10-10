import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../models";
import { authenticateRequest } from "../services/auth/session.service";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  sessionId: string | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures; protected ones reject below.
    console.error("[auth] context authentication failed:", error instanceof Error ? error.message : error);
  }
  return { req: opts.req, res: opts.res, user: auth?.user ?? null, sessionId: auth?.sessionId ?? null };
}
