import api from "@/lib/api";
import { uiText } from "@/lib/i18n/clientLocale";

export interface CreateMomoOrderRequest {
  planCode: "PRO" | "ULTRA";
  durationMonths?: number;
}

export interface CreateStripeSessionRequest {
  planCode: "PRO" | "ULTRA";
}

export interface CreateStripeSessionResponse {
  sessionId: string;
  url: string;
}

export interface CreateMomoOrderResponse {
  payUrl: string;
  orderId: string;
  amount: number;
  planCode: string;
}

export interface SyncMomoOrderResponse {
  status: string;
  orderId: string;
  momoResultCode: number | null;
  message: string;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  priceVnd: number;
  discountPriceVnd?: number;
  durationMonths: number;
  featuresJson: Record<string, unknown>;
}

/** MoMo khuyến nghị timeout query ≥30s — client phải chờ backend gọi MoMo xong. */
const MOMO_HTTP_TIMEOUT_MS = 45_000;

/**
 * Tạo đơn thanh toán MoMo và nhận payUrl để redirect
 */
export async function createMomoOrder(
  req: CreateMomoOrderRequest
): Promise<CreateMomoOrderResponse> {
  try {
    const { data } = await api.post<CreateMomoOrderResponse>(
      "/payments/momo/create-order",
      { durationMonths: 1, ...req },
      { timeout: MOMO_HTTP_TIMEOUT_MS }
    );
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        uiText({
          vi: "Không thể tạo đơn thanh toán MoMo",
          en: "Could not create the MoMo payment order",
          de: "MoMo-Zahlungsauftrag konnte nicht erstellt werden",
        })
    );
  }
}

/**
 * Tạo Stripe Checkout Session và nhận url để redirect
 */
export async function createStripeSession(
  req: CreateStripeSessionRequest
): Promise<CreateStripeSessionResponse> {
  try {
    const { data } = await api.post<CreateStripeSessionResponse>(
      "/payments/stripe/create-session",
      req
    );
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        uiText({
          vi: "Không thể tạo phiên thanh toán Stripe",
          en: "Could not create the Stripe checkout session",
          de: "Stripe-Checkout-Sitzung konnte nicht erstellt werden",
        })
    );
  }
}

/** Đối soát đơn với MoMo (Query API) và kích hoạt gói nếu thanh toán đã thành công — dùng khi IPN chậm hoặc không tới server. */
export async function syncMomoOrder(orderId: string): Promise<SyncMomoOrderResponse> {
  try {
    const { data } = await api.post<SyncMomoOrderResponse>(
      "/payments/momo/sync-order",
      { orderId },
      { timeout: MOMO_HTTP_TIMEOUT_MS }
    );
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.detail ||
        uiText({
          vi: "Không thể đồng bộ trạng thái thanh toán",
          en: "Could not sync the payment status",
          de: "Zahlungsstatus konnte nicht synchronisiert werden",
        })
    );
  }
}
