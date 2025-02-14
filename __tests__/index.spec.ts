import { beforeAll, describe, expect, it } from "bun:test";
import { getUnixTime, addDays, addMonths, endOfDay, addWeeks } from "date-fns";
import type Stripe from "stripe";
import timekeeper from "timekeeper";

import { assertPhasesAreContinuous } from "../utils";
import { scheduleSubscriptionUpdates } from "../index";

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

describe("buildPhasesForQuantityUpdates", () => {
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
        addMonths(new Date(subscription_renews_at * 1000), 1)
      ),
      items: [
        {
          ...DEFAULT_ITEM_PROPERTIES,
          quantity: 5,
        },
      ],
    };
    const existingPhases = [currentPhase, nextPhase];

    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 6,
          scheduled_at: subscription_renews_at,
        },
      ],
    });

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
        addMonths(new Date(subscription_renews_at * 1000), 1)
      ),
      items: [
        {
          ...DEFAULT_ITEM_PROPERTIES,
          quantity: 3,
        },
      ],
    };
    const existingPhases = [currentPhase, restOfPeriodPhase, afterRenewalPhase];

    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 6,
          scheduled_at: subscription_renews_at,
        },
      ],
    });

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

    const first_update_at = getUnixTime(endOfDay(new Date()));
    const second_update_at = getUnixTime(addDays(endOfDay(new Date()), 1));
    const third_update_at = getUnixTime(addDays(endOfDay(new Date()), 2));

    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 6,
          scheduled_at: first_update_at,
        },
        {
          newQuantity: 12,
          scheduled_at: second_update_at,
        },
        {
          newQuantity: 42,
          scheduled_at: third_update_at,
        },
      ],
    });

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
      addWeeks(new Date(currentPhase.end_date * 1000), 1)
    );
    const second_update_at = getUnixTime(
      addWeeks(new Date(first_update_at * 1000), 1)
    );

    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 6,
          scheduled_at: first_update_at,
        },
        {
          newQuantity: 42,
          scheduled_at: second_update_at,
        },
      ],
    });

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

  it("Throws when updating quantity in the past", () => {
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

    // Schedule update for 1 week before now
    const update_at = getUnixTime(addWeeks(new Date(), -1));
    expect(() =>
      scheduleSubscriptionUpdates({
        existingPhases,
        propertyUpdates: [
          {
            newQuantity: 6,
            scheduled_at: update_at,
          },
        ],
      })
    ).toThrow();
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
        addMonths(new Date(subscription_renews_at * 1000), 1)
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
    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 10,
          scheduled_at: current_day_ends_at,
        },
        {
          newQuantity: 6,
          scheduled_at: subscription_renews_at,
        },
      ],
    });

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
    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 10,
          scheduled_at: current_day_ends_at,
        },
        {
          newQuantity: 6,
          scheduled_at: subscription_renews_at,
        },
      ],
    });

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
        addMonths(new Date(subscription_renews_at * 1000), 1)
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
    const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases,
      propertyUpdates: [
        {
          newQuantity: 15,
          scheduled_at: current_day_ends_at,
        },
        {
          newQuantity: 6,
          scheduled_at: subscription_renews_at,
        },
      ],
    });

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
});
