# simple-stripe-schedules

## Easily schedule Stripe subscription changes

This package exposes a `scheduleSubscriptionUpdates` function that will build the array of phases required to achieve the desired scheduling.

Example:

```ts
const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
const subscription = await stripe.subscriptions.retrieve(subscriptionId)
const updatedPhases = scheduleSubscriptionUpdates(schedule, {
  activeDiscounts: subscription.discounts,
  propertyUpdates: [
    {
      quantity: 6,
      scheduled_at: 1739538925,
    },
    {
      quantity: 42,
      scheduled_at: 1747221323,
    },
  ],
})
await stripe.subscriptionSchedules.update(schedule.id, { phases: updatedPhases })
```

## Discounts

When a phase starts, Stripe redeems the phase's coupons again unless a discount from the same coupon is still active. Splitting a phase therefore creates new redemption points: once the original discount expired, copying its coupon onto the phases cut from it would grant the discount a second time, mid-period.

To keep splits billing-neutral, `activeDiscounts` (the subscription's current `discounts`) is required:

- Phases cut from a phase that already started reference the active discounts by ID, so a running discount keeps running and an expired one is never redeemed again.
- Phases that have not started yet keep the coupons and promotion codes they plan to redeem. References to discounts that are no longer active are dropped, since Stripe rejects them.
- The legacy `coupon` field is folded into `discounts`, since Stripe rejects updates setting both.

## Contributing

To install dependencies:

```bash
bun install
```

To test:

```bash
bun test
```

To build:

```bash
bun run build
```
