import { getAccessToken } from "./authSession";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface CreateMomoOrderRequest {
  planCode: "PRO" | "ULTRA";
  durationMonths?: number;
}

export interface CreateMomoOrderResponse {
  payUrl: string;
  orderId: string;
  amount: number;
  planCode: string;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  priceVnd: number;
  discountPriceVnd?: number;
  durationMonths: number;
  featuresJson: Record<string, unknown>;
}

/**
 * Tạo đơn thanh toán MoMo và nhận payUrl để redirect
 */
export async function createMomoOrder(
  req: CreateMomoOrderRequest
): Promise<CreateMomoOrderResponse> {
  const res = await fetch(`${API}/api/payments/momo/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
    body: JSON.stringify({ durationMonths: 1, ...req }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Không thể tạo đơn thanh toán MoMo"
    );
  }
  return res.json();
}
