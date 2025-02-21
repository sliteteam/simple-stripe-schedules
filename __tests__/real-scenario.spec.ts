import type Stripe from "stripe";
import { describe, expect, it } from "bun:test";
import { scheduleSubscriptionUpdates } from "../src";

describe(`Updating quantity at the end of the day and then at renewal (same quantity)`, () => {
  const EXISTING_PHASES: Stripe.SubscriptionSchedule.Phase[] = [
    {
      add_invoice_items: [],
      application_fee_percent: null,
      automatic_tax: { disabled_reason: null, enabled: false, liability: null },
      billing_cycle_anchor: null,
      billing_thresholds: null,
      collection_method: null,
      coupon: null,
      currency: "usd",
      default_payment_method: null,
      default_tax_rates: [],
      description: null,
      discounts: [],
      end_date: 1742564650,
      invoice_settings: null,
      items: [
        {
          billing_thresholds: null,
          discounts: [],
          metadata: {},
          plan: "plan_foobar",
          price: "plan_foobar",
          quantity: 1,
          tax_rates: [],
        },
      ],
      metadata: {},
      on_behalf_of: null,
      proration_behavior: "create_prorations",
      start_date: 1740145450,
      transfer_data: null,
      trial_end: null,
    },
  ];

  const propertyChanges = [
    { quantity: 2, scheduled_at: 1740178799 },
    { quantity: 2, scheduled_at: 1742564650 },
  ];

  it("Creates 1 phase from current phase start to end of day, and one from end of day to after renewal", () => {
    const updatedPhases = scheduleSubscriptionUpdates({
      propertyUpdates: propertyChanges,
      existingPhases: EXISTING_PHASES,
    });

    expect(updatedPhases).toHaveLength(2);

    expect(updatedPhases[0].start_date).toBe(1740145450);
    expect(updatedPhases[0].end_date).toBe(1740178799);
    expect(updatedPhases[0].items[0].quantity).toBe(1);

    expect(updatedPhases[1].start_date).toBe(1740178799);
    expect(updatedPhases[1].end_date).toBeUndefined();
    expect(updatedPhases[1].items[0].quantity).toBe(2);
  });
});

describe(`Updating quantity at the end of the day and then at renewal (different quantities)`, () => {
  const EXISTING_PHASES: Stripe.SubscriptionSchedule.Phase[] = [
    {
      add_invoice_items: [],
      application_fee_percent: null,
      automatic_tax: { disabled_reason: null, enabled: false, liability: null },
      billing_cycle_anchor: null,
      billing_thresholds: null,
      collection_method: null,
      coupon: null,
      currency: "usd",
      default_payment_method: null,
      default_tax_rates: [],
      description: null,
      discounts: [],
      end_date: 1742564650,
      invoice_settings: null,
      items: [
        {
          billing_thresholds: null,
          discounts: [],
          metadata: {},
          plan: "plan_foobar",
          price: "plan_foobar",
          quantity: 1,
          tax_rates: [],
        },
      ],
      metadata: {},
      on_behalf_of: null,
      proration_behavior: "create_prorations",
      start_date: 1740145450,
      transfer_data: null,
      trial_end: null,
    },
  ];

  const propertyChanges = [
    { quantity: 3, scheduled_at: 1740178799 },
    { quantity: 2, scheduled_at: 1742564650 },
  ];

  it("Creates 1 phase from current phase start to end of day, and one from end of day to after renewal", () => {
    const updatedPhases = scheduleSubscriptionUpdates({
      propertyUpdates: propertyChanges,
      existingPhases: EXISTING_PHASES,
    });

    expect(updatedPhases).toHaveLength(3);

    expect(updatedPhases[0].start_date).toBe(1740145450);
    expect(updatedPhases[0].end_date).toBe(1740178799);
    expect(updatedPhases[0].items[0].quantity).toBe(1);

    expect(updatedPhases[1].start_date).toBe(1740178799);
    expect(updatedPhases[1].end_date).toBe(1742564650);
    expect(updatedPhases[1].items[0].quantity).toBe(3);

    expect(updatedPhases[2].start_date).toBe(1742564650);
    expect(updatedPhases[2].end_date).toBeUndefined();
    expect(updatedPhases[2].items[0].quantity).toBe(2);
  });
});
