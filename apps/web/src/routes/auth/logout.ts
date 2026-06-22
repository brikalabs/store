import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/auth";

/** `GET /auth/logout`: GET shim over BetterAuth's POST sign-out (so plain links work); flow in {@link signOut}. */
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      GET: ({ request }) => signOut(request),
    },
  },
});
