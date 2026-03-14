import { redirect } from "next/navigation";
import { auth } from "~/server/lib/auth";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  if (session.user.banned) {
    // For now, redirect to login with an error message or we can create a specific page later
    // Let's just go to login which will show the banned error if they try to log in again
    redirect("/login?error=banned");
  }

  if (session.user.role === "admin") {
    redirect("/admin");
  }

  redirect("/staff");
}
