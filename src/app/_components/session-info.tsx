"use client";

import { authClient } from "~/server/lib/auth-client";

export function SessionInfo() {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) {
    return <span>Loading session...</span>;
  }

  if (error) {
    return <span>Error: {error.message}</span>;
  }

  if (!session) {
    return <span>Not logged in</span>;
  }

  return <span>User: {session.user.id}</span>;
}

