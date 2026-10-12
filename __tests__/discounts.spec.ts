import { beforeAll, describe, expect, it } from "bun:test";
import { addDays, endOfDay, getUnixTime } from "date-fns";
import type Stripe from "stripe";
import timekeeper from "timekeeper";

import { scheduleSubscriptionUpdates } from "../src/index";
import { assertPhasesAreContinuous } from "../src/utils";

const NOW = "2026-08-04T15:00:00Z";
const COUPON = "15_PERCENT_1YEAR";
const ACTIVE_DISCOUNT = "di_active";

function buildSchedule(
	phases: Stripe.SubscriptionSchedule.Phase[],
): Pick<Stripe.SubscriptionSchedule, "phases" | "end_behavior"> {
	return { phases, end_behavior: "release" };
}

function phaseDiscount(
	discount: Partial<Stripe.SubscriptionSchedule.Phase.Discount>,
): Stripe.SubscriptionSchedule.Phase.Discount {
	return { coupon: null, discount: null, promotion_code: null, ...discount };
}

function buildPhase({
	start,
	end,
	quantity,
	coupon = null,
	discounts = [],
}: {
	start: number;
	end: number;
	quantity: number;
	coupon?: string | null;
	discounts?: Stripe.SubscriptionSchedule.Phase.Discount[];
}): Stripe.SubscriptionSchedule.Phase {
	return {
		add_invoice_items: [],
		application_fee_percent: null,
		billing_cycle_anchor: null,
		billing_thresholds: null,
		collection_method: "send_invoice",
		coupon,
		currency: "usd",
		default_payment_method: null,
		description: null,
		discounts,
		end_date: end,
		invoice_settings: null,
		items: [
			{
				billing_thresholds: null,
				discounts: [],
				metadata: {},
				plan: "price_enterprise",
				price: "price_enterprise",
				quantity,
			},
		],
		metadata: {},
		on_behalf_of: null,
		proration_behavior: "create_prorations",
		start_date: start,
		transfer_data: null,
		trial_end: null,
	};
}

function phaseWithCouponFromStripe(phase: { start: number; end: number; quantity: number }) {
	return buildPhase({
		...phase,
		coupon: COUPON,
		discounts: [phaseDiscount({ coupon: COUPON })],
	});
}

describe("discounts on scheduled phases", () => {
	let periodStart: number;
	let endOfToday: number;
	let renewal: number;

	beforeAll(() => {
		timekeeper.freeze(NOW);
		periodStart = getUnixTime(addDays(new Date(), -19));
		endOfToday = getUnixTime(endOfDay(new Date()));
		renewal = getUnixTime(addDays(new Date(), 345));
	});

	function scheduleDailyProration(
		existingPhases: Stripe.SubscriptionSchedule.Phase[],
		activeDiscounts: Parameters<
			typeof scheduleSubscriptionUpdates
		>[1]["activeDiscounts"],
	) {
		return scheduleSubscriptionUpdates(buildSchedule(existingPhases), {
			activeDiscounts,
			propertyUpdates: [
				{ quantity: 42, scheduled_at: endOfToday },
				{ quantity: 42, scheduled_at: renewal },
			],
		});
	}

	describe("phases cut from a phase that already started", () => {
		it("does not redeem the started phase's coupon again once its discount expired", () => {
			const currentPhase = phaseWithCouponFromStripe({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});

			const phases = scheduleDailyProration([currentPhase], []);

			expect(phases).toHaveLength(2);
			assertPhasesAreContinuous(phases);
			expect(phases[1].start_date).toBe(endOfToday);
			for (const phase of phases) {
				expect(phase.discounts).toEqual([]);
				expect(phase).not.toHaveProperty("coupon");
			}
		});

		it("keeps the active discount running by referencing it instead of the coupon", () => {
			const currentPhase = phaseWithCouponFromStripe({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});

			const phases = scheduleDailyProration([currentPhase], [ACTIVE_DISCOUNT]);

			expect(phases).toHaveLength(2);
			for (const phase of phases) {
				expect(phase.discounts).toEqual([{ discount: ACTIVE_DISCOUNT }]);
				expect(phase).not.toHaveProperty("coupon");
			}
		});

		it("keeps a discount applied to the subscription but not listed on the phase", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});

			const phases = scheduleDailyProration([currentPhase], [ACTIVE_DISCOUNT]);

			for (const phase of phases) {
				expect(phase.discounts).toEqual([{ discount: ACTIVE_DISCOUNT }]);
			}
		});

		it("accepts expanded discount objects as active discounts", () => {
			const currentPhase = phaseWithCouponFromStripe({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});

			const phases = scheduleDailyProration(
				[currentPhase],
				[{ id: ACTIVE_DISCOUNT }, "di_other"],
			);

			for (const phase of phases) {
				expect(phase.discounts).toEqual([
					{ discount: ACTIVE_DISCOUNT },
					{ discount: "di_other" },
				]);
			}
		});

		it("drops a reference to a discount that is no longer active", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
				discounts: [phaseDiscount({ discount: "di_expired" })],
			});

			const phases = scheduleDailyProration([currentPhase], []);

			for (const phase of phases) {
				expect(phase.discounts).toEqual([]);
			}
		});
	});

	describe("phases that have not started yet", () => {
		it("keeps the coupon a future phase plans to redeem", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});
			const renewalPhase = phaseWithCouponFromStripe({
				start: renewal,
				end: getUnixTime(addDays(new Date(renewal * 1000), 365)),
				quantity: 41,
			});

			const phases = scheduleDailyProration([currentPhase, renewalPhase], []);

			expect(phases).toHaveLength(3);
			expect(phases[0].discounts).toEqual([]);
			expect(phases[1].discounts).toEqual([]);
			expect(phases[2].start_date).toBe(renewal);
			expect(phases[2].discounts).toEqual([{ coupon: COUPON }]);
			expect(phases[2]).not.toHaveProperty("coupon");
		});

		it("folds a coupon only set in the legacy coupon field into discounts", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});
			const renewalPhase = buildPhase({
				start: renewal,
				end: getUnixTime(addDays(new Date(renewal * 1000), 365)),
				quantity: 41,
				coupon: COUPON,
			});

			const phases = scheduleDailyProration([currentPhase, renewalPhase], []);

			expect(phases[2].discounts).toEqual([{ coupon: COUPON }]);
		});

		it("keeps promotion codes and active discount references, and drops inactive ones", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});
			const renewalPhase = buildPhase({
				start: renewal,
				end: getUnixTime(addDays(new Date(renewal * 1000), 365)),
				quantity: 41,
				discounts: [
					phaseDiscount({ promotion_code: "promo_renewal" }),
					phaseDiscount({ discount: ACTIVE_DISCOUNT }),
					phaseDiscount({ discount: "di_expired" }),
				],
			});

			const phases = scheduleDailyProration(
				[currentPhase, renewalPhase],
				[ACTIVE_DISCOUNT],
			);

			expect(phases[2].discounts).toEqual([
				{ promotion_code: "promo_renewal" },
				{ discount: ACTIVE_DISCOUNT },
			]);
		});

		it("does not merge a future phase into the current one when their discounts differ", () => {
			const currentPhase = buildPhase({
				start: periodStart,
				end: renewal,
				quantity: 41,
			});
			const renewalPhase = phaseWithCouponFromStripe({
				start: renewal,
				end: getUnixTime(addDays(new Date(renewal * 1000), 365)),
				quantity: 41,
			});

			const phases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase, renewalPhase]),
				{
					activeDiscounts: [],
					propertyUpdates: [{ quantity: 41, scheduled_at: endOfToday }],
				},
			);

			expect(phases).toHaveLength(2);
			expect(phases[0].end_date).toBe(renewal);
			expect(phases[1].discounts).toEqual([{ coupon: COUPON }]);
		});
	});

	it("merges phases whose items and discounts match", () => {
		const currentPhase = phaseWithCouponFromStripe({
			start: periodStart,
			end: renewal,
			quantity: 41,
		});

		const phases = scheduleSubscriptionUpdates(buildSchedule([currentPhase]), {
			activeDiscounts: [ACTIVE_DISCOUNT],
			propertyUpdates: [{ quantity: 41, scheduled_at: endOfToday }],
		});

		expect(phases).toHaveLength(1);
		expect(phases[0].start_date).toBe(periodStart);
		expect(phases[0].end_date).toBe(renewal);
		expect(phases[0].discounts).toEqual([{ discount: ACTIVE_DISCOUNT }]);
	});

	it("resolves discounts when there is nothing to schedule", () => {
		const currentPhase = phaseWithCouponFromStripe({
			start: periodStart,
			end: renewal,
			quantity: 41,
		});
		const renewalPhase = phaseWithCouponFromStripe({
			start: renewal,
			end: getUnixTime(addDays(new Date(renewal * 1000), 365)),
			quantity: 41,
		});

		const phases = scheduleSubscriptionUpdates(
			buildSchedule([currentPhase, renewalPhase]),
			{ activeDiscounts: [] },
		);

		expect(phases[0].discounts).toEqual([]);
		expect(phases[1].discounts).toEqual([{ coupon: COUPON }]);
		for (const phase of phases) {
			expect(phase).not.toHaveProperty("coupon");
		}
	});
});
