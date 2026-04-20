import type Stripe from "stripe";

export type ScheduledPropertyUpdates = {
	itemIndex?: number;
	quantity?: number;
	price?: string;
	coupon?: string;
	proration_behavior?: Stripe.SubscriptionScheduleUpdateParams.Phase.ProrationBehavior;
	scheduled_at: number;
};
