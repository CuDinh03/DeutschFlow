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
  try {
    const { data } = await api.post<CreateMomoOrderResponse>(
      "/payments/momo/create-order",
      { durationMonths: 1, ...req }
    );
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || "Không thể tạo đơn thanh toán MoMo"
    );
  }
}
