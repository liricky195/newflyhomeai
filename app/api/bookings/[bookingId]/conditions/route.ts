import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getBookingById } from "@/lib/db";
import { ApiError } from "@/lib/duffel";

const BASE_URL = "https://api.duffel.com";

function duffelHeaders(): Record<string, string> {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) throw new Error("DUFFEL_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Duffel-Version": "v2",
    Accept: "application/json",
  };
}

interface BaggageItem {
  quantity: number;
  type: string;
  max_weight_kg: number | null;
}

interface ConditionsResponse {
  available: boolean;
  baggage?: {
    cabin: BaggageItem[];
    checked: BaggageItem[];
  };
  conditions?: {
    refundable: boolean;
    refundPenalty: string | null;
    refundPenaltyCurrency: string | null;
    changeable: boolean;
    changePenalty: string | null;
    changePenaltyCurrency: string | null;
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  // Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initDb();

  // Booking lookup
  const booking = getBookingById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Ownership check
  if (booking.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Do not call Duffel for cancelled bookings — the order may no longer be retrievable
  if (booking.status !== "confirmed") {
    return NextResponse.json({ available: false } satisfies ConditionsResponse);
  }

  if (!booking.duffel_order_id) {
    return NextResponse.json({ available: false } satisfies ConditionsResponse);
  }

  // Fetch full order from Duffel
  type BaggageShape = {
    type: "carry_on" | "checked";
    quantity: number;
    max_weight_kg?: number | null;
  };
  type ConditionDetail = {
    allowed: boolean;
    penalty_amount: string | null;
    penalty_currency: string | null;
  };
  type DuffelOrderFull = {
    data: {
      slices: Array<{
        segments: Array<{
          passengers: Array<{
            baggages?: BaggageShape[];
          }>;
        }>;
      }>;
      conditions?: {
        refund_before_departure?: ConditionDetail | null;
        change_before_departure?: ConditionDetail | null;
      };
    };
  };

  let order: DuffelOrderFull;
  try {
    const res = await fetch(`${BASE_URL}/air/orders/${booking.duffel_order_id}`, {
      headers: duffelHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new ApiError(res.status, text);
    }
    order = (await res.json()) as DuffelOrderFull;
  } catch (err) {
    const message =
      err instanceof ApiError ? err.apiMessage : (err as Error).message;
    return NextResponse.json(
      { error: `Failed to fetch order conditions: ${message}` },
      { status: 502 }
    );
  }

  // Extract baggage — aggregate across all slices/segments/passengers
  const bagMap = new Map<"carry_on" | "checked", { quantity: number; max_weight_kg: number | null }>();
  for (const slice of order.data.slices ?? []) {
    for (const seg of slice.segments ?? []) {
      for (const pax of seg.passengers ?? []) {
        for (const b of pax.baggages ?? []) {
          const existing = bagMap.get(b.type);
          if (existing) {
            existing.quantity += b.quantity;
            if (existing.max_weight_kg === null && b.max_weight_kg != null) {
              existing.max_weight_kg = b.max_weight_kg;
            }
          } else {
            bagMap.set(b.type, {
              quantity: b.quantity,
              max_weight_kg: b.max_weight_kg ?? null,
            });
          }
        }
      }
    }
  }

  const cabin: BaggageItem[] = [];
  const checked: BaggageItem[] = [];
  const carryOn = bagMap.get("carry_on");
  if (carryOn) cabin.push({ quantity: carryOn.quantity, type: "carry_on", max_weight_kg: carryOn.max_weight_kg });
  const checkedBag = bagMap.get("checked");
  if (checkedBag) checked.push({ quantity: checkedBag.quantity, type: "checked", max_weight_kg: checkedBag.max_weight_kg });

  // Extract conditions
  const cond = order.data.conditions;
  const refund = cond?.refund_before_departure;
  const change = cond?.change_before_departure;

  const response: ConditionsResponse = {
    available: true,
    baggage: { cabin, checked },
    conditions: {
      refundable: refund?.allowed ?? false,
      refundPenalty: refund?.penalty_amount ?? null,
      refundPenaltyCurrency: refund?.penalty_currency ?? null,
      changeable: change?.allowed ?? false,
      changePenalty: change?.penalty_amount ?? null,
      changePenaltyCurrency: change?.penalty_currency ?? null,
    },
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
