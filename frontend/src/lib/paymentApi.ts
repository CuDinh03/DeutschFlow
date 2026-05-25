import api from "@/lib/api";

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
      error.response?.data?.message || "Không thể tạo đơn thanh toán MoMo"
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
        "Không thể đồng bộ trạng thái thanh toán"
    );
  }
}
