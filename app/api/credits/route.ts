import { auth } from "@clerk/nextjs/server";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { getBalance } from "@/lib/credits";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { error: { code: "unauthorized", message: "Sign in to see your credits." } },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const credits = await getBalance(userId);
    return Response.json({ credits, packs: CREDIT_PACKS }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/credits] balance failed", error);
    return Response.json(
      {
        error: {
          code: "credits_unavailable",
          message: "Could not load your credits. Try again.",
        },
      },
      { status: 502, headers: NO_STORE },
    );
  }
}
