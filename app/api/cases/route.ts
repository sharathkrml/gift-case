import { auth } from "@clerk/nextjs/server";
import { addCredits, NoCreditsError, spendCredit } from "@/lib/credits";
import { BriefError, generateCase } from "@/lib/generate-case";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return fail(401, "unauthorized", "Sign in to open a case.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json", "Send a JSON body with a brief.");
  }

  const brief =
    typeof body === "object" && body !== null && "brief" in body
      ? String((body as { brief?: unknown }).brief ?? "").trim()
      : "";

  if (brief.length < 10) {
    return fail(
      400,
      "brief_too_short",
      "Give the detective a little more to work with.",
    );
  }
  if (brief.length > 500) {
    return fail(400, "brief_too_long", "Keep the statement under 500 characters.");
  }

  let spent = false;

  try {
    const remaining = await spendCredit(userId);
    spent = true;

    const giftCase = await generateCase(brief);
    return Response.json(giftCase, {
      headers: { ...NO_STORE, "X-Credits-Remaining": String(remaining) },
    });
  } catch (error) {
    if (spent) {
      try {
        await addCredits(userId, 1);
      } catch (refundError) {
        console.error("[api/cases] credit refund failed", refundError);
      }
    }

    if (error instanceof NoCreditsError) {
      return fail(
        402,
        "no_credits",
        "You're out of case credits. Buy more to keep investigating.",
      );
    }
    if (error instanceof BriefError) {
      return fail(422, "unreadable_brief", error.message);
    }

    console.error("[api/cases] generation failed", error);
    return fail(
      502,
      "upstream_error",
      "The trail went cold while searching. Try the case again.",
    );
  }
}
