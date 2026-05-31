import { auth } from "@clerk/nextjs/server";

/** Returns the signed-in Clerk user id, or throws (routes are already protected by middleware). */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
