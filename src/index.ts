import type Stripe from "stripe";
import {
  applyPropertyUpdatesOnNewPhases,
  assertHasNoPastPhases,
  assertPhasesAreContinuous,
  buildPhaseListFromExistingPhasesAndPropertyUpdates,
  getPhaseUpdateParamsFromExistingPhase,
  mergeAdjacentPhaseUpdates,
  removePastPhases,
} from "./utils";
import type { ScheduledPropertyUpdates } from "./types";

/**
 * Schedules a value change for a property (quantity, price...) at a specific time.
 *
 * Existing phases will be preserved, and property updates will be applied on top of them.
 * New phases will be created to accommodate the property updates.
 * Consecutive phases with identical properties will be merged into a single phase.
 *
 * @param existingPhases Array of preexisting phases in the schedule if any. Pass an empty array if there aren't any.
 * @param propertyUpdates Array of ScheduledPropertyUpdates objects that represent the property updates to apply.
 * @returns Array of SubscriptionScheduleUpdateParams.Phase objects that represent the updated phases and can be passed to stripe.subscriptionSchedules.update
 */
export function scheduleSubscriptionUpdates({
  existingPhases,
  propertyUpdates,
  cancelAt,
}: {
  existingPhases?: Stripe.SubscriptionSchedule.Phase[];
  propertyUpdates?: ScheduledPropertyUpdates[];
  cancelAt?: number;
}): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  // No updates to do, just return the existing phases
  if ((!propertyUpdates || propertyUpdates.length === 0) && !cancelAt) {
    if (!existingPhases) {
      throw new Error("Nothing to schedule and no existing phases");
    }
    return existingPhases.map((phase) =>
      getPhaseUpdateParamsFromExistingPhase(phase)
    );
  }

  // Sort property updates in chronological order
  if (propertyUpdates) {
    propertyUpdates.sort((a, b) => a.scheduled_at - b.scheduled_at);
  }

  // Step 1: Build a list of all required phases, with their start_date and end_date.

  const newPhases = buildPhaseListFromExistingPhasesAndPropertyUpdates(
    existingPhases ?? [],
    propertyUpdates ?? [],
    cancelAt
  );

  // Step 2: Apply property changes on the correct phases

  const phasesWithUpdatedProperties = applyPropertyUpdatesOnNewPhases(
    newPhases,
    propertyUpdates ?? []
  );

  // Step 4: Remove past phases

  const filteredPhases = removePastPhases(phasesWithUpdatedProperties);

  // Step 5: Merge identical adjacent phases

  const finalPhases = mergeAdjacentPhaseUpdates(filteredPhases);

  assertHasNoPastPhases(finalPhases);
  assertPhasesAreContinuous(finalPhases);

  return finalPhases;
}
