import { describe, expect, it } from "bun:test";
import type Stripe from "stripe";

import { mergeAdjacentPhaseUpdates } from "../src/utils";

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
