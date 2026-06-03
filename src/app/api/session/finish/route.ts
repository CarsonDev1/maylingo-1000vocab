import { NextResponse } from "next/server";
import { learnWords, finishReviewSession } from "@/lib/actions";

/**
 * Persist a finished learn/review session.
 *
 * Called via plain fetch (not a Server Action) on purpose: a Server Action would
 * trigger Next's automatic refresh of the current route, which re-fetches the now
 * consumed word list and swaps the finish / level-up screen for the lesson's
 * "done" / empty state — looking like an unwanted auto-redirect.
 */
export async function POST(req: Request) {
  let body: { mode?: string; wordIds?: number[]; reviewed?: number; correct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (body.mode === "learn") {
      await learnWords(Array.isArray(body.wordIds) ? body.wordIds : []);
    } else {
      await finishReviewSession(body.reviewed ?? 0, body.correct ?? 0);
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
