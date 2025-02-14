# simple-stripe-schedules

## Easily schedule Stripe subscription changes

This package exposes a `scheduleSubscriptionUpdates` function that will build the array of phases required to achieve the desired scheduling.

Example:

```ts
const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
const updatedPhases = scheduleSubscriptionUpdates({
      existingPhases: schedule.phases,
      propertyUpdates: [
        {
          newQuantity: 6,
          scheduled_at: 1739538925,
        },
        {
          newQuantity: 42,
          scheduled_at: 1747221323,
        },
      ],
    });
await stripe.subscriptionSchedules.update(schedule.id, phases: updatedPhases)
```

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
bun build ./index.ts --outdir ./build
```
