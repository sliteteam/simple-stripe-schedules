import { describe, expect, it } from "bun:test";
import type Stripe from "stripe";

import {
  assertHasNoPastPhases,
  mergeAdjacentPhaseUpdates,
  removePastPhases,
} from "../src/utils";
import timekeeper from "timekeeper";
import { addDays } from "date-fns";

describe("mergeAdjacentPhaseUpdates", () => {
  it("Merges adjacent phases with same properties", () => {
    const phase1: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 1,
      end_date: 2,
    };
    const phase2: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 2,
      end_date: 3,
    };
    const phase3: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 3,
      end_date: 4,
    };

    const mergedPhases = mergeAdjacentPhaseUpdates([phase1, phase2, phase3]);

    expect(mergedPhases).toHaveLength(1);
    expect(mergedPhases[0].start_date).toBe(1);
    expect(mergedPhases[0].end_date).toBe(4);
  });

  it('does not merge adjacent phases with different "plan"', () => {
    const phase1: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 1,
      end_date: 2,
    };
    const phase2: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price2",
          quantity: 10,
        },
      ],
      start_date: 2,
      end_date: 3,
    };
    const phase3: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 3,
      end_date: 4,
    };

    const mergedPhases = mergeAdjacentPhaseUpdates([phase1, phase2, phase3]);

    expect(mergedPhases).toHaveLength(3);
    expect(mergedPhases[0].start_date).toBe(1);
    expect(mergedPhases[0].end_date).toBe(2);
    expect(mergedPhases[0].items[0].plan).toBe("price1");
    expect(mergedPhases[1].start_date).toBe(2);
    expect(mergedPhases[1].end_date).toBe(3);
    expect(mergedPhases[1].items[0].plan).toBe("price2");
    expect(mergedPhases[2].start_date).toBe(3);
    expect(mergedPhases[2].end_date).toBe(4);
    expect(mergedPhases[2].items[0].plan).toBe("price1");
  });

  it('does not merge adjacent phases with different "quantity"', () => {
    const phase1: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 1,
        },
      ],
      start_date: 1,
      end_date: 2,
    };
    const phase2: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 1,
        },
      ],
      start_date: 2,
      end_date: 3,
    };
    const phase3: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 3,
      end_date: 4,
    };

    const mergedPhases = mergeAdjacentPhaseUpdates([phase1, phase2, phase3]);

    expect(mergedPhases).toHaveLength(2);
    expect(mergedPhases[0].start_date).toBe(1);
    expect(mergedPhases[0].end_date).toBe(3);
    expect(mergedPhases[0].items[0].quantity).toBe(1);
    expect(mergedPhases[1].start_date).toBe(3);
    expect(mergedPhases[1].end_date).toBe(4);
    expect(mergedPhases[1].items[0].quantity).toBe(10);
  });

  it("preserves phases with no end date", () => {
    const phase1: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 1,
        },
      ],
      start_date: 1,
      end_date: 2,
    };
    const phase2: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 2,
        },
      ],
      start_date: 2,
      end_date: undefined,
    };
    const phases = [phase1, phase2];
    const mergedPhases = mergeAdjacentPhaseUpdates(phases);
    expect(mergedPhases).toHaveLength(2);
    expect(mergedPhases[0].start_date).toBe(1);
    expect(mergedPhases[0].end_date).toBe(2);
    expect(mergedPhases[1].start_date).toBe(2);
    expect(mergedPhases[1].end_date).toBeUndefined();
  });
});

describe("removePastPhases", () => {
  it("Removes phases ending in the past", () => {
    timekeeper.freeze(new Date());
    const currentPhaseStart = addDays(new Date(), -1).getTime() / 1000;
    const currentPhaseEnd = addDays(new Date(), 10).getTime() / 1000;
    const pastPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 1,
      end_date: 2,
    };
    const currentPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price2",
          quantity: 42,
        },
      ],
      start_date: currentPhaseStart,
      end_date: currentPhaseEnd,
    };

    const filteredPhases = removePastPhases([pastPhase, currentPhase]);

    expect(filteredPhases).toHaveLength(1);
    expect(filteredPhases[0].start_date).toBe(currentPhaseStart);
    expect(filteredPhases[0].end_date).toBe(currentPhaseEnd);
  });

  it("Removes phases ending now", () => {
    timekeeper.freeze(new Date());
    const currentPhaseEnd = addDays(new Date(), 10).getTime() / 1000;
    const pastPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price1",
          quantity: 10,
        },
      ],
      start_date: 1,
      end_date: "now",
    };
    const currentPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: [
        {
          plan: "price2",
          quantity: 42,
        },
      ],
      start_date: "now",
      end_date: currentPhaseEnd,
    };

    const filteredPhases = removePastPhases([pastPhase, currentPhase]);

    expect(filteredPhases).toHaveLength(1);
    expect(filteredPhases[0].start_date).toBe("now");
    expect(filteredPhases[0].end_date).toBe(currentPhaseEnd);
  });

  it("does not affect complex phases when they are not past", () => {
    timekeeper.freeze("2025-02-05T15:00:00Z");
    const fullPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [
      {
        currency: "usd",
        description: "",
        end_date: 1739631600,
        start_date: 1737039600,
        proration_behavior: "always_invoice",
        coupon: undefined,
        add_invoice_items: [],
        application_fee_percent: undefined,
        automatic_tax: undefined,
        billing_cycle_anchor: undefined,
        billing_thresholds: null,
        collection_method: "charge_automatically",
        default_payment_method: undefined,
        default_tax_rates: undefined,
        discounts: [],
        invoice_settings: {
          account_tax_ids: undefined,
          days_until_due: 0,
          issuer: undefined,
        },
        metadata: {},
        on_behalf_of: undefined,
        transfer_data: undefined,
        trial_end: undefined,
        items: [
          {
            quantity: 10,
            plan: "price1",
            price: "price1",
            billing_thresholds: undefined,
            discounts: [],
            metadata: {},
            tax_rates: undefined,
          },
        ],
      },
      {
        currency: "usd",
        description: "",
        end_date: 1740236400,
        start_date: 1739631600,
        proration_behavior: "always_invoice",
        coupon: undefined,
        add_invoice_items: [],
        application_fee_percent: undefined,
        automatic_tax: undefined,
        billing_cycle_anchor: undefined,
        billing_thresholds: null,
        collection_method: "charge_automatically",
        default_payment_method: undefined,
        default_tax_rates: undefined,
        discounts: [],
        invoice_settings: {
          account_tax_ids: undefined,
          days_until_due: 0,
          issuer: undefined,
        },
        metadata: {},
        on_behalf_of: undefined,
        transfer_data: undefined,
        trial_end: undefined,
        items: [
          {
            quantity: 10,
            plan: "price1",
            price: "price1",
            billing_thresholds: undefined,
            discounts: [],
            metadata: {},
            tax_rates: undefined,
          },
        ],
      },
      {
        currency: "usd",
        description: "",
        end_date: 1740841200,
        start_date: 1740236400,
        proration_behavior: "always_invoice",
        coupon: undefined,
        add_invoice_items: [],
        application_fee_percent: undefined,
        automatic_tax: undefined,
        billing_cycle_anchor: undefined,
        billing_thresholds: null,
        collection_method: "charge_automatically",
        default_payment_method: undefined,
        default_tax_rates: undefined,
        discounts: [],
        invoice_settings: {
          account_tax_ids: undefined,
          days_until_due: 0,
          issuer: undefined,
        },
        metadata: {},
        on_behalf_of: undefined,
        transfer_data: undefined,
        trial_end: undefined,
        items: [
          {
            quantity: 6,
            plan: "price1",
            price: "price1",
            billing_thresholds: undefined,
            discounts: [],
            metadata: {},
            tax_rates: undefined,
          },
        ],
      },
      {
        currency: "usd",
        description: "",
        end_date: undefined,
        start_date: 1740841200,
        proration_behavior: "always_invoice",
        coupon: undefined,
        add_invoice_items: [],
        application_fee_percent: undefined,
        automatic_tax: undefined,
        billing_cycle_anchor: undefined,
        billing_thresholds: null,
        collection_method: "charge_automatically",
        default_payment_method: undefined,
        default_tax_rates: undefined,
        discounts: [],
        invoice_settings: {
          account_tax_ids: undefined,
          days_until_due: 0,
          issuer: undefined,
        },
        metadata: {},
        on_behalf_of: undefined,
        transfer_data: undefined,
        trial_end: undefined,
        items: [
          {
            quantity: 42,
            plan: "price1",
            price: "price1",
            billing_thresholds: undefined,
            discounts: [],
            metadata: {},
            tax_rates: undefined,
          },
        ],
      },
    ];

    const filteredPhases = removePastPhases(fullPhases);

    expect(filteredPhases).toEqual(fullPhases);
  });
});

describe("assertHasNoPastPhases", () => {
  it("Does not throw when there are no past phases", () => {
    timekeeper.freeze(new Date());
    expect(() =>
      assertHasNoPastPhases([
        {
          start_date: new Date().getTime() / 1000,
          end_date: addDays(new Date(), 10).getTime() / 1000,
        },
        {
          start_date: addDays(new Date(), 10).getTime() / 1000,
          end_date: addDays(new Date(), 20).getTime() / 1000,
        },
      ])
    ).not.toThrow();
  });

  it("Throws when there is a past phase", () => {
    timekeeper.freeze(new Date());
    expect(() =>
      assertHasNoPastPhases([
        {
          start_date: 1,
          end_date: 2,
        },
        {
          start_date: 2,
          end_date: addDays(new Date(), 20).getTime() / 1000,
        },
      ])
    ).toThrow();

    expect(() =>
      assertHasNoPastPhases([
        {
          start_date: 1,
          end_date: "now",
        },
        {
          start_date: "now",
          end_date: addDays(new Date(), 20).getTime() / 1000,
        },
      ])
    ).toThrow();
  });
});
