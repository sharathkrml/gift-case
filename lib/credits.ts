import { clerkClient } from "@clerk/nextjs/server";
import {
  CREDIT_PACKS,
  FREE_CREDITS,
  type CreditPack,
} from "@/lib/credit-packs";
import { capturePayPalOrder, readCompletedCapture } from "@/lib/paypal";

export class NoCreditsError extends Error {}

type Purchase = {
  orderId: string;
  packId: string;
  credits: number;
  at: string;
};

function readCredits(metadata: Record<string, unknown>) {
  return typeof metadata.credits === "number" &&
    Number.isFinite(metadata.credits)
    ? Math.max(0, Math.floor(metadata.credits))
    : null;
}

function readPurchases(metadata: Record<string, unknown>): Purchase[] {
  if (!Array.isArray(metadata.purchases)) return [];
  return metadata.purchases.filter((entry): entry is Purchase => {
    if (!entry || typeof entry !== "object") return false;
    const value = entry as Partial<Purchase>;
    return (
      typeof value.orderId === "string" &&
      typeof value.packId === "string" &&
      typeof value.credits === "number"
    );
  });
}

async function userMetadata(userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return {
    client,
    metadata: user.privateMetadata as Record<string, unknown>,
  };
}

export async function getBalance(userId: string) {
  const { client, metadata } = await userMetadata(userId);
  const credits = readCredits(metadata);
  if (credits !== null) return credits;

  await client.users.updateUserMetadata(userId, {
    privateMetadata: { credits: FREE_CREDITS },
  });
  return FREE_CREDITS;
}

// shortcut: balances live in Clerk private metadata with read-modify-write.
// Move to a transactional store before high-volume or concurrent use.
export async function spendCredit(userId: string) {
  const { client, metadata } = await userMetadata(userId);
  const current = readCredits(metadata) ?? FREE_CREDITS;
  if (current < 1) throw new NoCreditsError("No case credits left.");

  const remaining = current - 1;
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { credits: remaining },
  });
  return remaining;
}

export async function addCredits(userId: string, amount: number) {
  const { client, metadata } = await userMetadata(userId);
  const current = readCredits(metadata) ?? FREE_CREDITS;
  const credits = current + Math.max(0, Math.floor(amount));

  await client.users.updateUserMetadata(userId, {
    privateMetadata: { credits },
  });
  return credits;
}

async function creditPurchase(
  userId: string,
  orderId: string,
  pack: CreditPack,
) {
  const { client, metadata } = await userMetadata(userId);
  const current = readCredits(metadata) ?? FREE_CREDITS;
  const purchases = readPurchases(metadata);

  if (purchases.some((purchase) => purchase.orderId === orderId)) {
    return { credits: current, added: 0 };
  }

  const credits = current + pack.credits;
  const nextPurchases = [
    ...purchases,
    {
      orderId,
      packId: pack.id,
      credits: pack.credits,
      at: new Date().toISOString(),
    },
  ].slice(-20);

  await client.users.updateUserMetadata(userId, {
    privateMetadata: { credits, purchases: nextPurchases },
  });

  return { credits, added: pack.credits };
}

export async function captureCredits(userId: string, orderId: string) {
  // shortcut: credits are granted on the return capture. Add a PayPal
  // webhook before production so a closed browser cannot strand a paid order.
  const order = await capturePayPalOrder(orderId);
  const capture = readCompletedCapture(order);

  if (capture.userId !== userId) {
    throw new Error("This payment belongs to another account.");
  }

  const pack = CREDIT_PACKS.find((item) => item.id === capture.packId);
  if (!pack) throw new Error("Unknown credit pack.");

  if (capture.currency !== "USD" || capture.amountMinor !== pack.priceMinor) {
    throw new Error("Payment amount did not match the credit pack.");
  }

  return creditPurchase(userId, capture.orderId, pack);
}
