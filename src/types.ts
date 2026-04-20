import type Stripe from "stripe";

export type ScheduledPropertyUpdates = {
	subscriptionItemId?: string;
	quantity?: number;
	price?: string;
	coupon?: string;
	proration_behavior?: Stripe.SubscriptionScheduleUpdateParams.Phase.ProrationBehavior;
	scheduled_at: number;
};
