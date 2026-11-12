const BASE_URL =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export class PayPalConfigError extends Error {}

type PayPalLink = { href?: string; rel?: string; method?: string };

type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: {
        id?: string;
        status?: string;
        custom_id?: string;
        amount?: { currency_code?: string; value?: string };
      }[];
    };
  }[];
  links?: PayPalLink[];
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !secret) {
    throw new PayPalConfigError(
      "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing.",
    );
  }
  if (clientId === secret) {
    throw new PayPalConfigError(
      "PAYPAL_CLIENT_SECRET is identical to PAYPAL_CLIENT_ID.",
    );
  }
  return { clientId, secret };
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as {
      message?: string;
      error_description?: string;
      details?: { description?: string }[];
    };
    return (
      data.details?.[0]?.description ??
      data.error_description ??
      data.message ??
      text.slice(0, 300)
    );
  } catch {
    return text.slice(0, 300);
  }
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const { clientId, secret } = credentials();
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `PayPal auth failed (${response.status}): ${await readError(response)}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("PayPal auth returned no access token.");
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };
  return data.access_token;
}

export type CreditOrder = { orderId: string; approveUrl: string };

export async function createPayPalOrder(input: {
  userId: string;
  packId: string;
  credits: number;
  priceMinor: number;
  origin: string;
}): Promise<CreditOrder> {
  const token = await accessToken();
  const response = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "The Gift Case",
            landing_page: "LOGIN",
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${input.origin}/api/credits/capture`,
            cancel_url: `${input.origin}/credits?cancelled=1`,
          },
        },
      },
      purchase_units: [
        {
          description: `${input.credits} Gift Case credits`,
          custom_id: `${input.userId}|${input.packId}`,
          amount: {
            currency_code: "USD",
            value: (input.priceMinor / 100).toFixed(2),
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(
      `PayPal create order failed (${response.status}): ${await readError(response)}`,
    );
  }

  const data = (await response.json()) as PayPalOrder;
  const approveUrl = data.links?.find(
    (link) => link.rel === "payer-action" || link.rel === "approve",
  )?.href;

  if (!data.id || !approveUrl) {
    throw new Error("PayPal did not return an approval URL.");
  }

  return { orderId: data.id, approveUrl };
}

export type CompletedCapture = {
  orderId: string;
  userId: string;
  packId: string;
  amountMinor: number;
  currency: string;
};

export function readCompletedCapture(order: PayPalOrder): CompletedCapture {
  if (order.status !== "COMPLETED") {
    throw new Error(`PayPal order is ${order.status ?? "unknown"}.`);
  }

  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") {
    throw new Error("PayPal capture is not complete.");
  }

  const customId = capture.custom_id ?? unit?.custom_id ?? "";
  const [userId, packId] = customId.split("|");
  const value = Number(capture.amount?.value);
  const currency = capture.amount?.currency_code;

  if (!order.id || !userId || !packId || !Number.isFinite(value) || !currency) {
    throw new Error("PayPal capture is missing metadata.");
  }

  return {
    orderId: order.id,
    userId,
    packId,
    amountMinor: Math.round(value * 100),
    currency,
  };
}

async function getOrder(orderId: string) {
  const token = await accessToken();
  const response = await fetch(
    `${BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `PayPal get order failed (${response.status}): ${await readError(response)}`,
    );
  }

  return (await response.json()) as PayPalOrder;
}

export async function capturePayPalOrder(orderId: string) {
  const token = await accessToken();
  const response = await fetch(
    `${BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 422 && text.includes("ORDER_ALREADY_CAPTURED")) {
      return getOrder(orderId);
    }
    throw new Error(
      `PayPal capture failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  return (await response.json()) as PayPalOrder;
}
