import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/src/routes/api.router";
import { apiUrl } from "@/constants/config";
import * as Auth from "@/lib/_core/auth";

/** Type-safe client for the API server (types come from server/src/routes/api.router.ts). */
export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        // Resolved lazily so a missing API URL surfaces as a query error instead of a crash.
        url: (() => {
          try {
            return apiUrl("/api/trpc");
          } catch {
            return "/api/trpc";
          }
        })(),
        // tRPC v11: transformer lives on the link
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
