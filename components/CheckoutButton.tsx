"use client";

import { useState } from "react";

export function CheckoutButton({ packId }: { packId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const payload = (await response.json()) as {
        approveUrl?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.approveUrl) {
        throw new Error(
          payload.error?.message ?? "Could not start the PayPal checkout.",
        );
      }

      window.location.assign(payload.approveUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start the PayPal checkout.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="go" onClick={startCheckout} disabled={busy}>
        {busy ? "Opening PayPal…" : "Buy with PayPal"}
      </button>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  );
}
