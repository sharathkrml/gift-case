import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getBalance } from "@/lib/credits";

export const instant = false;

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { added, error } = await searchParams;
  const failed = Boolean(error);
  const credits = failed ? 0 : await getBalance(userId);
  const addedCount = Number(added);

  return (
    <main className="main">
      <div className="main-inner">
        <Link href="/" className="back-link">
          ← Back to the board
        </Link>
        <h1>{failed ? "Payment not confirmed" : "Payment received"}</h1>

        {failed ? (
          <>
            <p className="sub">We couldn&apos;t confirm that payment.</p>
            <p className="credits-note">
              No credits were added. If PayPal shows a completed payment,
              contact support with your PayPal receipt.
            </p>
            <Link href="/credits" className="go-link">
              Try again
            </Link>
          </>
        ) : (
          <>
            <p className="sub">
              {addedCount > 0
                ? `${addedCount} case credits were added.`
                : "This payment was already applied."}{" "}
              You now have {credits} case{credits === 1 ? "" : "s"} left.
            </p>
            <Link href="/" className="go-link">
              Open a case
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
