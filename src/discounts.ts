import type Stripe from "stripe";

export type ActiveDiscount = string | Pick<Stripe.Discount, "id">;

type PhaseDiscountParams = Stripe.SubscriptionScheduleUpdateParams.Phase.Discount;

type PhaseWithDiscounts = Pick<
	Stripe.SubscriptionSchedule.Phase | Stripe.SubscriptionScheduleUpdateParams.Phase,
	"coupon" | "discounts"
>;

function getId(value: string | { id: string } | null | undefined) {
	return typeof value === "string" ? value : value?.id;
}

function convertDiscountToUpdateParams(
	discount:
		| Stripe.SubscriptionSchedule.Phase.Discount
		| PhaseDiscountParams,
): PhaseDiscountParams {
	const coupon = getId(discount.coupon);
	const discountId = getId(discount.discount);
	const promotionCode = getId(discount.promotion_code);
	return {
		...(coupon && { coupon }),
		...(discountId && { discount: discountId }),
		...(promotionCode && { promotion_code: promotionCode }),
	};
}

/**
 * Stripe reports a phase's coupon both in the legacy `coupon` field and in `discounts`,
 * and rejects updates that set both, so the coupon is folded into `discounts`.
 */
export function convertPhaseDiscountsToUpdateParams(
	phase: PhaseWithDiscounts,
): PhaseDiscountParams[] {
	const declaredDiscounts =
		typeof phase.discounts === "string" ? [] : (phase.discounts ?? []);
	const discounts = declaredDiscounts.map(convertDiscountToUpdateParams);
	const legacyCoupon = getId(phase.coupon);
	const isLegacyCouponListed = discounts.some(
		(discount) => discount.coupon === legacyCoupon,
	);
	if (legacyCoupon && !isLegacyCouponListed) {
		discounts.push({ coupon: legacyCoupon });
	}
	return discounts;
}

/**
 * When a phase starts, Stripe redeems its coupons again unless a discount from the
 * same coupon is still active. A phase that already started has redeemed its coupons,
 * so the phases cut from it reference the subscription's active discounts instead:
 * that keeps a live discount running and never redeems an expired one again.
 * A phase that has not started keeps the redemptions it plans, minus references to
 * discounts that are no longer active, which Stripe rejects.
 */
export function resolvePhaseDiscounts(
	phase: PhaseWithDiscounts & {
		start_date?: Stripe.SubscriptionSchedule.Phase["start_date"] | "now";
	},
	activeDiscounts: ActiveDiscount[],
): PhaseDiscountParams[] {
	const activeDiscountIds = activeDiscounts.map(getId);
	const hasStarted =
		phase.start_date === "now" ||
		(phase.start_date !== undefined && phase.start_date <= Date.now() / 1000);

	if (hasStarted) {
		return activeDiscountIds.map((discount) => ({ discount }));
	}

	return convertPhaseDiscountsToUpdateParams(phase).filter(
		(discount) =>
			discount.discount === undefined ||
			activeDiscountIds.includes(discount.discount),
	);
}

function discountKey(discount: PhaseDiscountParams) {
	return [discount.coupon, discount.discount, discount.promotion_code].join(":");
}

export function haveSameDiscounts(
	a: Pick<Stripe.SubscriptionScheduleUpdateParams.Phase, "discounts">,
	b: Pick<Stripe.SubscriptionScheduleUpdateParams.Phase, "discounts">,
) {
	const keysOf = (phase: typeof a) =>
		(typeof phase.discounts === "string" ? [] : (phase.discounts ?? []))
			.map(discountKey)
			.sort()
			.join("|");
	return keysOf(a) === keysOf(b);
}
