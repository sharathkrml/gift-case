import { auth } from "@clerk/nextjs/server";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { createPayPalOrder, PayPalConfigError } from "@/lib/paypal";

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
    return fail(401, "unauthorized", "Sign in to buy case credits.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json", "Choose a credit pack.");
  }

  const packId =
    typeof body === "object" && body !== null && "packId" in body
      ? String((body as { packId?: unknown }).packId ?? "")
      : "";
  const pack = CREDIT_PACKS.find((item) => item.id === packId);
  if (!pack) {
    return fail(400, "unknown_pack", "Choose a valid credit pack.");
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    new URL(request.url).origin;

  try {
    const order = await createPayPalOrder({
      userId,
      packId: pack.id,
      credits: pack.credits,
      priceMinor: pack.priceMinor,
      origin,
    });
    return Response.json(order, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof PayPalConfigError) {
      console.error("[api/credits/checkout] PayPal config error", error);
      return fail(
        503,
        "paypal_unconfigured",
        process.env.NODE_ENV === "production"
          ? "PayPal is not configured yet."
          : error.message,
      );
    }
    console.error("[api/credits/checkout] PayPal checkout failed", error);
    return fail(
      502,
      "paypal_unavailable",
      "PayPal checkout is unavailable right now. Try again.",
    );
  }
}
