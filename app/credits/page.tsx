import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CheckoutButton } from "@/components/CheckoutButton";
import { CREDIT_PACKS, FREE_CREDITS } from "@/lib/credit-packs";
import { getBalance } from "@/lib/credits";
import { formatPrice } from "@/lib/cases";

export const instant = false;

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { cancelled } = await searchParams;
  const credits = await getBalance(userId);

  return (
    <main className="main">
      <div className="main-inner">
        <Link href="/" className="back-link">
          ← Back to the board
        </Link>
        <h1>Case credits</h1>
        <p className="sub">
          One credit opens one gift case. New detectives start with{" "}
          {FREE_CREDITS} free cases.
        </p>

        {cancelled && (
          <p className="error" role="alert">
            Checkout cancelled. No charge was made.
          </p>
        )}

        <div className="file">
          <label>Your balance</label>
          <div className="credit-balance">
            <strong>{credits}</strong>
            <span>{credits === 1 ? "case left" : "cases left"}</span>
          </div>
        </div>

        <div className="credits-grid">
          {CREDIT_PACKS.map((pack) => (
            <div className="credit-pack" key={pack.id}>
              <div className="credit-pack-name">{pack.name}</div>
              <div className="credit-pack-credits">{pack.credits} cases</div>
              <div className="credit-pack-price">
                {formatPrice(pack.priceMinor, "USD")}
              </div>
              <div className="credit-pack-unit">
                {formatPrice(Math.round(pack.priceMinor / pack.credits), "USD")}{" "}
                per case
              </div>
              <CheckoutButton packId={pack.id} />
            </div>
          ))}
        </div>

        <p className="credits-note">
          Payments are processed by PayPal. Credits are added after PayPal
          confirms the payment.
        </p>
      </div>
    </main>
  );
}
