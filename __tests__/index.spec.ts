import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { getUnixTime, addDays, addMonths, endOfDay, addWeeks } from "date-fns";
import type Stripe from "stripe";
import timekeeper from "timekeeper";

import { assertPhasesAreContinuous } from "../src/utils";
import { scheduleSubscriptionUpdates } from "../src/index";

function buildSchedule(
	phases: Stripe.SubscriptionSchedule.Phase[],
	end_behavior?: Stripe.SubscriptionSchedule.EndBehavior | null,
): Pick<Stripe.SubscriptionSchedule, "phases" | "end_behavior"> {
	return { phases, end_behavior: end_behavior ?? "release" };
}

const DEFAULT_PHASE_PROPERTIES: Stripe.SubscriptionSchedule.Phase = {
	items: [],
	add_invoice_items: [],
	application_fee_percent: null,
	billing_cycle_anchor: null,
	billing_thresholds: null,
	collection_method: "charge_automatically",
	coupon: null,
	currency: "usd",
	default_payment_method: null,
	description: "",
	discounts: [],
	end_date: 0,
	start_date: 0,
	invoice_settings: {
		account_tax_ids: null,
		days_until_due: 0,
		issuer: null,
	},
	metadata: {},
	on_behalf_of: null,
	proration_behavior: "always_invoice",
	transfer_data: null,
	trial_end: null,
};

const DEFAULT_ITEM_PROPERTIES: Stripe.SubscriptionSchedule.Phase.Item = {
	billing_thresholds: null,
	discounts: [],
	metadata: {},
	plan: "price1",
	price: "price1",
};

describe("scheduleSubscriptionUpdates", () => {
	beforeAll(() => {
		timekeeper.freeze("2025-02-05T15:00:00Z");
	});
	it("Updates quantity when phases match exactly", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};
		const nextPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_renews_at,
			end_date: getUnixTime(
				addMonths(new Date(subscription_renews_at * 1000), 1),
			),
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 5,
				},
			],
		};
		const existingPhases = [currentPhase, nextPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 6,
						scheduled_at: subscription_renews_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(2);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(currentPhase.start_date);
		expect(updatedPhases[0].end_date).toBe(currentPhase.end_date);

		expect(updatedPhases[1].items[0].quantity).toBe(6);
		expect(updatedPhases[1].start_date).toBe(nextPhase.start_date);
		expect(updatedPhases[1].end_date).toBe(nextPhase.end_date);
	});

	it("Updates quantity when multiple phases exists", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: current_day_ends_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};
		const restOfPeriodPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: current_day_ends_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 15,
				},
			],
		};
		const afterRenewalPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_renews_at,
			end_date: getUnixTime(
				addMonths(new Date(subscription_renews_at * 1000), 1),
			),
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 3,
				},
			],
		};
		const existingPhases = [currentPhase, restOfPeriodPhase, afterRenewalPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 6,
						scheduled_at: subscription_renews_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(3);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(currentPhase.start_date);
		expect(updatedPhases[0].end_date).toBe(currentPhase.end_date);

		expect(updatedPhases[1].items[0].quantity).toBe(15);
		expect(updatedPhases[1].start_date).toBe(restOfPeriodPhase.start_date);
		expect(updatedPhases[1].end_date).toBe(restOfPeriodPhase.end_date);

		expect(updatedPhases[2].items[0].quantity).toBe(6);
		expect(updatedPhases[2].start_date).toBe(afterRenewalPhase.start_date);
		expect(updatedPhases[2].end_date).toBe(afterRenewalPhase.end_date);
	});

	it("Updates quantity with more updates than existing phases", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));

		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		const first_update_at = getUnixTime(endOfDay(new Date()));
		const second_update_at = getUnixTime(addDays(endOfDay(new Date()), 1));
		const third_update_at = getUnixTime(addDays(endOfDay(new Date()), 2));

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 6,
						scheduled_at: first_update_at,
					},
					{
						quantity: 12,
						scheduled_at: second_update_at,
					},
					{
						quantity: 42,
						scheduled_at: third_update_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(4);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(currentPhase.start_date);
		expect(updatedPhases[0].end_date).toBe(first_update_at);

		expect(updatedPhases[1].items[0].quantity).toBe(6);
		expect(updatedPhases[1].start_date).toBe(first_update_at);
		expect(updatedPhases[1].end_date).toBe(second_update_at);

		expect(updatedPhases[2].items[0].quantity).toBe(12);
		expect(updatedPhases[2].start_date).toBe(second_update_at);
		expect(updatedPhases[2].end_date).toBe(third_update_at);

		expect(updatedPhases[3].items[0].quantity).toBe(42);
		expect(updatedPhases[3].start_date).toBe(third_update_at);
		expect(updatedPhases[3].end_date).toBe(currentPhase.end_date);
	});

	it("Updates quantity after the last phase end", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		// Schedule updates for 1 week and 2 weeks after end of last phase
		const first_update_at = getUnixTime(
			addWeeks(new Date(currentPhase.end_date * 1000), 1),
		);
		const second_update_at = getUnixTime(
			addWeeks(new Date(first_update_at * 1000), 1),
		);

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 6,
						scheduled_at: first_update_at,
					},
					{
						quantity: 42,
						scheduled_at: second_update_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(3);

		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(currentPhase.start_date);
		expect(updatedPhases[0].end_date).toBe(first_update_at);

		expect(updatedPhases[1].items[0].quantity).toBe(6);
		expect(updatedPhases[1].start_date).toBe(first_update_at);
		expect(updatedPhases[1].end_date).toBe(second_update_at);

		expect(updatedPhases[2].items[0].quantity).toBe(42);
		expect(updatedPhases[2].start_date).toBe(second_update_at);
		expect(updatedPhases[2].end_date).toBeUndefined();
	});

	it("Does not throw when updating quantity in the past", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		// Schedule update for 1 week before now (during current phase)
		expect(() =>
			scheduleSubscriptionUpdates(
				buildSchedule(existingPhases),
				{
					propertyUpdates: [
						{
							quantity: 6,
							scheduled_at: getUnixTime(addWeeks(new Date(), -1)),
						},
					],
				},
			),
		).not.toThrow();

		// Schedule update for 1 month before now (before current phase)
		expect(() =>
			scheduleSubscriptionUpdates(
				buildSchedule(existingPhases),
				{
					propertyUpdates: [
						{
							quantity: 6,
							scheduled_at: getUnixTime(addMonths(new Date(), -1)),
						},
					],
				},
			),
		).not.toThrow();
	});

	it("Handles daily proration update to the same quantity + renewal change", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: current_day_ends_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};
		const restOfPeriodPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: current_day_ends_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 15,
				},
			],
		};
		const afterRenewalPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_renews_at,
			end_date: getUnixTime(
				addMonths(new Date(subscription_renews_at * 1000), 1),
			),
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 1,
				},
			],
		};
		const existingPhases = [currentPhase, restOfPeriodPhase, afterRenewalPhase];

		// Simulate a diminution of the user count:
		// We change down to the floored amount until period end, then reduce the quantity upon renewal
		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 10,
						scheduled_at: current_day_ends_at,
					},
					{
						quantity: 6,
						scheduled_at: subscription_renews_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(2);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(subscription_renews_at);

		expect(updatedPhases[1].items[0].quantity).toBe(6);
		expect(updatedPhases[1].start_date).toBe(subscription_renews_at);
		expect(updatedPhases[1].end_date).toBe(afterRenewalPhase.end_date);
	});

	it("Handles daily proration update to the same quantity + renewal change when there is a single existing phase", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		// Simulate a diminution of the user count:
		// We change down to the floored amount until period end, then reduce the quantity upon renewal
		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 10,
						scheduled_at: current_day_ends_at,
					},
					{
						quantity: 6,
						scheduled_at: subscription_renews_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(2);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(subscription_renews_at);

		expect(updatedPhases[1].items[0].quantity).toBe(6);
		expect(updatedPhases[1].start_date).toBe(subscription_renews_at);
		expect(updatedPhases[1].end_date).toBeUndefined();
	});

	it("Handles daily proration changes when a plan change is scheduled upon renewal", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};
		const afterRenewalPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_renews_at,
			end_date: getUnixTime(
				addMonths(new Date(subscription_renews_at * 1000), 1),
			),
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
					price: "updatedPrice",
					plan: "updatedPrice",
				},
			],
		};

		const existingPhases = [currentPhase, afterRenewalPhase];

		// For the sake of testing: we first increase the quantity to 15, then down to 6 after renewal
		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 15,
						scheduled_at: current_day_ends_at,
					},
					{
						quantity: 6,
						scheduled_at: subscription_renews_at,
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(3);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].items[0].price).toBe("price1");
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(current_day_ends_at);

		expect(updatedPhases[1].items[0].quantity).toBe(15);
		expect(updatedPhases[1].items[0].price).toBe("price1");
		expect(updatedPhases[1].start_date).toBe(current_day_ends_at);
		expect(updatedPhases[1].end_date).toBe(subscription_renews_at);

		expect(updatedPhases[2].items[0].quantity).toBe(6);
		expect(updatedPhases[2].items[0].price).toBe("updatedPrice");
		expect(updatedPhases[2].start_date).toBe(subscription_renews_at);
		expect(updatedPhases[2].end_date).toBe(afterRenewalPhase.end_date);
	});

	it("Handles proration_behavior", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 15,
						scheduled_at: current_day_ends_at,
						proration_behavior: "none",
					},
				],
			},
		);

		expect(updatedPhases).toHaveLength(2);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].items[0].price).toBe("price1");
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(current_day_ends_at);
		expect(updatedPhases[0].proration_behavior).toBe("always_invoice");

		expect(updatedPhases[1].items[0].quantity).toBe(15);
		expect(updatedPhases[1].items[0].price).toBe("price1");
		expect(updatedPhases[1].start_date).toBe(current_day_ends_at);
		expect(updatedPhases[1].end_date).toBe(subscription_renews_at);
		expect(updatedPhases[1].proration_behavior).toBe("none");
	});

	it("Handles cancellation in the middle of existing phases", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				cancelAt: current_day_ends_at,
			},
		);

		expect(updatedPhases).toHaveLength(1);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].items[0].price).toBe("price1");
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(current_day_ends_at);
	});

	it("Ignores property updates scheduled after cancellation", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const current_day_ends_at = getUnixTime(endOfDay(new Date()));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 15,
						scheduled_at: subscription_renews_at,
						proration_behavior: "none",
					},
				],
				cancelAt: current_day_ends_at,
			},
		);

		expect(updatedPhases).toHaveLength(1);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].items[0].price).toBe("price1");
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(current_day_ends_at);
	});

	it("Does not produce a trailing phase without end_date when end_behavior is cancel", () => {
		timekeeper.freeze("2026-02-17T15:00:00Z");
		const existingPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: 1751587199,
			end_date: 1771501770,
			proration_behavior: "create_prorations",
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					plan: "price_1R1R5eA9f3uvREqkQwMz6EGr",
					price: "price_1R1R5eA9f3uvREqkQwMz6EGr",
					quantity: 35,
				},
			],
		};

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule([existingPhase], "cancel"),
			{
				propertyUpdates: [
					{
						quantity: 36,
						scheduled_at: 1771501770,
					},
				],
			},
		);

		// When end_behavior is "cancel", the last phase must have an end_date.
		// Stripe rejects schedules where end_behavior != "release" and the last phase has no end_date,
		// with error: "The last phase must specify either `duration` or `end_date` if `end_behavior` is not `release`."
		// So the trailing phase with no end_date should not be produced.
		for (const phase of updatedPhases) {
			expect(phase.end_date).toBeDefined();
		}

		// Restore frozen time for other tests
		timekeeper.freeze("2025-02-05T15:00:00Z");
	});

	describe("multi-item subscriptions", () => {
		it("Throws when a phase has multiple items and no itemIndex is passed", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(buildSchedule([currentPhase]), {
					propertyUpdates: [
						{
							quantity: 6,
							scheduled_at: subscription_renews_at,
						},
					],
				}),
			).toThrow();
		});

		it("Defaults itemIndex to 0 on single-item phases for backwards compatibility", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							quantity: 6,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases[1].items[0].quantity).toBe(6);
		});

		it("Does not throw when phases have multiple items but there are no property updates", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const cancel_at = getUnixTime(addDays(new Date(), 5));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(buildSchedule([currentPhase]), {
					cancelAt: cancel_at,
				}),
			).not.toThrow();
		});

		it("Updates the quantity of only the targeted item by itemIndex", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 0,
							quantity: 6,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(2);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items).toHaveLength(2);
			expect(updatedPhases[0].items[0].plan).toBe("price1");
			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[0].items[1].plan).toBe("price2");
			expect(updatedPhases[0].items[1].quantity).toBe(3);
			expect(updatedPhases[0].start_date).toBe(subscription_started_at);
			expect(updatedPhases[0].end_date).toBe(subscription_renews_at);

			expect(updatedPhases[1].items).toHaveLength(2);
			expect(updatedPhases[1].items[0].plan).toBe("price1");
			expect(updatedPhases[1].items[0].quantity).toBe(6);
			expect(updatedPhases[1].items[1].plan).toBe("price2");
			expect(updatedPhases[1].items[1].quantity).toBe(3);
			expect(updatedPhases[1].start_date).toBe(subscription_renews_at);
		});

		it("Updates the price of only the targeted item by itemIndex", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 1,
							price: "price2_updated",
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(2);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items).toHaveLength(2);
			expect(updatedPhases[0].items[0].plan).toBe("price1");
			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[0].items[1].plan).toBe("price2");
			expect(updatedPhases[0].items[1].quantity).toBe(3);

			expect(updatedPhases[1].items).toHaveLength(2);
			expect(updatedPhases[1].items[0].plan).toBe("price1");
			expect(updatedPhases[1].items[0].quantity).toBe(10);
			expect(updatedPhases[1].items[1].plan).toBe("price2_updated");
			expect(updatedPhases[1].items[1].price).toBe("price2_updated");
			expect(updatedPhases[1].items[1].quantity).toBe(3);
		});

		it("Applies distinct updates to distinct items across a single phase boundary", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 0,
							quantity: 20,
							scheduled_at: subscription_renews_at,
						},
						{
							itemIndex: 1,
							quantity: 7,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(2);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items).toHaveLength(2);
			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[0].items[1].quantity).toBe(3);

			expect(updatedPhases[1].items).toHaveLength(2);
			expect(updatedPhases[1].items[0].plan).toBe("price1");
			expect(updatedPhases[1].items[0].quantity).toBe(20);
			expect(updatedPhases[1].items[1].plan).toBe("price2");
			expect(updatedPhases[1].items[1].quantity).toBe(7);
		});

		it("Applies updates to different items at different timestamps", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const current_day_ends_at = getUnixTime(endOfDay(new Date()));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 0,
							quantity: 20,
							scheduled_at: current_day_ends_at,
						},
						{
							itemIndex: 1,
							quantity: 7,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(3);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[0].items[1].quantity).toBe(3);
			expect(updatedPhases[0].start_date).toBe(subscription_started_at);
			expect(updatedPhases[0].end_date).toBe(current_day_ends_at);

			expect(updatedPhases[1].items[0].plan).toBe("price1");
			expect(updatedPhases[1].items[0].quantity).toBe(20);
			expect(updatedPhases[1].items[1].plan).toBe("price2");
			expect(updatedPhases[1].items[1].quantity).toBe(3);
			expect(updatedPhases[1].start_date).toBe(current_day_ends_at);
			expect(updatedPhases[1].end_date).toBe(subscription_renews_at);

			expect(updatedPhases[2].items[0].plan).toBe("price1");
			expect(updatedPhases[2].items[0].quantity).toBe(20);
			expect(updatedPhases[2].items[1].plan).toBe("price2");
			expect(updatedPhases[2].items[1].quantity).toBe(7);
			expect(updatedPhases[2].start_date).toBe(subscription_renews_at);
		});

		it("Throws when itemIndex is out of bounds for the phase", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(buildSchedule([currentPhase]), {
					propertyUpdates: [
						{
							itemIndex: 5,
							quantity: 6,
							scheduled_at: subscription_renews_at,
						},
					],
				}),
			).toThrow();
		});

		it("Targets the only item when an itemIndex of 0 is passed on a single-item phase", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 0,
							quantity: 6,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(2);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[1].items[0].quantity).toBe(6);
		});

		it("Merges adjacent multi-item phases when all items are identical", () => {
			const subscription_started_at = getUnixTime(addDays(new Date(), -20));
			const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
			const current_day_ends_at = getUnixTime(endOfDay(new Date()));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: subscription_started_at,
				end_date: current_day_ends_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};
			const nextPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: current_day_ends_at,
				end_date: subscription_renews_at,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			const updatedPhases = scheduleSubscriptionUpdates(
				buildSchedule([currentPhase, nextPhase]),
				{
					propertyUpdates: [
						{
							itemIndex: 0,
							quantity: 20,
							scheduled_at: subscription_renews_at,
						},
					],
				},
			);

			expect(updatedPhases).toHaveLength(2);
			assertPhasesAreContinuous(updatedPhases);

			expect(updatedPhases[0].items).toHaveLength(2);
			expect(updatedPhases[0].items[0].quantity).toBe(10);
			expect(updatedPhases[0].items[1].quantity).toBe(3);
			expect(updatedPhases[0].start_date).toBe(subscription_started_at);
			expect(updatedPhases[0].end_date).toBe(subscription_renews_at);

			expect(updatedPhases[1].items).toHaveLength(2);
			expect(updatedPhases[1].items[0].plan).toBe("price1");
			expect(updatedPhases[1].items[0].quantity).toBe(20);
			expect(updatedPhases[1].items[1].plan).toBe("price2");
			expect(updatedPhases[1].items[1].quantity).toBe(3);
		});

		it("Throws when current and future phases have different item counts", () => {
			const t0 = getUnixTime(addDays(new Date(), -20));
			const t1 = getUnixTime(addDays(new Date(), 5));
			const t2 = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: t0,
				end_date: t1,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};
			const nextPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: t1,
				end_date: t2,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(
					buildSchedule([currentPhase, nextPhase]),
					{},
				),
			).toThrow();
		});

		it("Ignores past phases when checking item count consistency", () => {
			const t_past_start = getUnixTime(addDays(new Date(), -40));
			const t_past_end = getUnixTime(addDays(new Date(), -20));
			const t_now = getUnixTime(addDays(new Date(), -20));
			const t_future = getUnixTime(addDays(new Date(), 10));
			const pastPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: t_past_start,
				end_date: t_past_end,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 1,
					},
				],
			};
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: t_now,
				end_date: t_future,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(
					buildSchedule([pastPhase, currentPhase]),
					{},
				),
			).not.toThrow();
		});

		it("Throws when itemIndex is out of bounds for current and future phases", () => {
			const t0 = getUnixTime(addDays(new Date(), -20));
			const t_renew = getUnixTime(addDays(new Date(), 10));
			const currentPhase: Stripe.SubscriptionSchedule.Phase = {
				...DEFAULT_PHASE_PROPERTIES,
				start_date: t0,
				end_date: t_renew,
				items: [
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price1",
						price: "price1",
						quantity: 10,
					},
					{
						...DEFAULT_ITEM_PROPERTIES,
						plan: "price2",
						price: "price2",
						quantity: 3,
					},
				],
			};

			expect(() =>
				scheduleSubscriptionUpdates(buildSchedule([currentPhase]), {
					propertyUpdates: [
						{
							itemIndex: 2,
							quantity: 6,
							scheduled_at: t_renew,
						},
					],
				}),
			).toThrow();
		});
	});

	it("Handles cancellation after the end of the existing phase", () => {
		const subscription_started_at = getUnixTime(addDays(new Date(), -20));
		const subscription_renews_at = getUnixTime(addDays(new Date(), 10));
		const cancel_at = getUnixTime(addDays(new Date(), 60));
		const currentPhase: Stripe.SubscriptionSchedule.Phase = {
			...DEFAULT_PHASE_PROPERTIES,
			start_date: subscription_started_at,
			end_date: subscription_renews_at,
			items: [
				{
					...DEFAULT_ITEM_PROPERTIES,
					quantity: 10,
				},
			],
		};

		const existingPhases = [currentPhase];

		const updatedPhases = scheduleSubscriptionUpdates(
			buildSchedule(existingPhases),
			{
				propertyUpdates: [
					{
						quantity: 15,
						scheduled_at: subscription_renews_at,
						proration_behavior: "none",
					},
				],
				cancelAt: cancel_at,
			},
		);

		expect(updatedPhases).toHaveLength(2);
		assertPhasesAreContinuous(updatedPhases);

		expect(updatedPhases[0].items[0].quantity).toBe(10);
		expect(updatedPhases[0].start_date).toBe(subscription_started_at);
		expect(updatedPhases[0].end_date).toBe(subscription_renews_at);

		expect(updatedPhases[1].items[0].quantity).toBe(15);
		expect(updatedPhases[1].start_date).toBe(subscription_renews_at);
		expect(updatedPhases[1].end_date).toBe(cancel_at);
	});
});
