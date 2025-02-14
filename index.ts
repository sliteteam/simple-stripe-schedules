import type Stripe from "stripe";
import {
  applyPropertyUpdatesOnNewPhases,
  buildPhaseListFromExistingPhasesAndPropertyUpdates,
  getPhaseUpdateParamsFromExistingPhase,
  mergeAdjacentPhaseUpdates,
  type ScheduledPropertyUpdates,
} from "./utils";

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
  propertyUpdates,
  existingPhases,
}: {
  propertyUpdates: ScheduledPropertyUpdates[];
  existingPhases?: Stripe.SubscriptionSchedule.Phase[];
}): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  // No updates to do, just return the existing phases
  if (propertyUpdates.length === 0) {
    if (!existingPhases) {
      throw new Error("No property updates to apply and no existing phases");
    }
    return existingPhases.map((phase) =>
      getPhaseUpdateParamsFromExistingPhase(phase)
    );
  }

  // Sort property updates in chronological order
  propertyUpdates.sort((a, b) => a.scheduled_at - b.scheduled_at);

  // Step 1: Build a list of all required phases, with their start_date and end_date.

  const newPhases = buildPhaseListFromExistingPhasesAndPropertyUpdates(
    existingPhases ?? [],
    propertyUpdates
  );

  // Step 2: Apply property changes on the correct phases

  const phasesWithUpdatedProperties = applyPropertyUpdatesOnNewPhases(
    newPhases,
    propertyUpdates
  );

  // Step 3: Merge identical adjacent phases

  return mergeAdjacentPhaseUpdates(phasesWithUpdatedProperties);
}
