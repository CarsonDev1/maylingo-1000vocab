import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getWordDetail } from "@/lib/queries";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wordId = Number(params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return NextResponse.json({ error: "Invalid word id" }, { status: 400 });
  }

  const detail = await getWordDetail(wordId);
  return NextResponse.json({ detail });
}
