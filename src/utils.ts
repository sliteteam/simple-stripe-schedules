import type Stripe from "stripe";
import {
  convertPhaseItemToUpdateParams,
  convertPhaseToPhaseUpdateParams,
} from "./conversion";
import type { ScheduledPropertyUpdates } from "./types";

export function getPhaseUpdateParamsFromExistingPhase(
  phase:
    | Stripe.SubscriptionSchedule.Phase
    | Stripe.SubscriptionScheduleUpdateParams.Phase,
  {
    propertiesToApply,
    startDate,
    endDate,
  }: {
    propertiesToApply?: Omit<ScheduledPropertyUpdates, "scheduled_at">;
    startDate?: number;
    endDate?: number | null;
  } = {}
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  if (phase.items.length > 1) {
    throw new Error(`We don't support multi-items phases yet`);
  }

  const phaseUpdateParams = convertPhaseToPhaseUpdateParams(phase);
  const phaseItemUpdateParams = convertPhaseItemToUpdateParams(phase.items[0]);

  const { price, quantity, proration_behavior } = propertiesToApply ?? {};

  const result = {
    ...phaseUpdateParams,
    items: [
      {
        ...phaseItemUpdateParams,
        ...(price && {
          plan: price,
          price: price,
        }),
        ...(quantity !== undefined && {
          quantity,
        }),
      },
    ],
    ...(startDate && { start_date: startDate }),
    end_date: endDate === null ? undefined : endDate ?? phase.end_date,
    ...(proration_behavior && { proration_behavior }),
  };
  return result;
}

export function assertPhasesAreContinuous(
  phases: Pick<
    Stripe.SubscriptionScheduleUpdateParams.Phase,
    "end_date" | "start_date"
  >[]
) {
  let lastPhaseEndDate;
  for (const phase of phases) {
    if (lastPhaseEndDate) {
      if (phase.start_date !== lastPhaseEndDate) {
        throw new Error(
          `Schedule continuity error: there is a gap between ${lastPhaseEndDate} and ${phase.start_date}`
        );
      }
    }
    lastPhaseEndDate = phase.end_date;
  }
}

export function assertHasNoPastPhases(
  phases: Pick<
    Stripe.SubscriptionScheduleUpdateParams.Phase,
    "end_date" | "start_date"
  >[]
) {
  for (const phase of phases) {
    if (
      phase.end_date &&
      (phase.end_date === "now" || phase.end_date < new Date().getTime() / 1000)
    ) {
      throw new Error(
        `Phase ending at "${phase.end_date}" ends now or in the past, it will be rejected by Stripe`
      );
    }
  }
}

/**
 * Merges adjacent phases that have the same properties
 * @param phases
 */
export function mergeAdjacentPhaseUpdates(
  phases: Stripe.SubscriptionScheduleUpdateParams.Phase[]
): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  const mergedPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [];
  let previousPhase: Stripe.SubscriptionScheduleUpdateParams.Phase | undefined;
  for (const phase of phases) {
    if (
      previousPhase &&
      previousPhase.items[0].plan === phase.items[0].plan &&
      previousPhase.items[0].price === phase.items[0].price &&
      previousPhase.items[0].quantity === phase.items[0].quantity
    ) {
      previousPhase.end_date = phase.end_date;
    } else {
      mergedPhases.push(phase);
      previousPhase = phase;
    }
  }
  return mergedPhases;
}

/**
 * Returns an array of phases, without already past phases
 * @param phases
 */
export function removePastPhases(
  phases: Stripe.SubscriptionScheduleUpdateParams.Phase[]
): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  return phases.filter(
    (phase) =>
      phase.end_date === undefined ||
      (phase.end_date !== "now" && phase.end_date > new Date().getTime() / 1000)
  );
}

export function compilePropertyUpdates(
  propertyUpdates: ScheduledPropertyUpdates[]
) {
  const result = propertyUpdates.reduce(
    (acc, propertyUpdate) => ({ ...acc, ...propertyUpdate }),
    propertyUpdates[0]
  );
  return result;
}

export function applyPropertyUpdatesOnNewPhases(
  phasesList: Stripe.SubscriptionScheduleUpdateParams.Phase[],
  propertyUpdates: ScheduledPropertyUpdates[]
) {
  let compiledPropertyUpdates: ScheduledPropertyUpdates = {
    scheduled_at: 0,
  };
  return phasesList.map((phase) => {
    // Compile all the property updates that should happen at the beginning of this phase,
    // With priority to the latest one
    const propertyUpdatesScheduledForThisPhase = propertyUpdates.filter(
      (propertyUpdate) => propertyUpdate.scheduled_at === phase.start_date
    );
    compiledPropertyUpdates = compilePropertyUpdates([
      compiledPropertyUpdates,
      ...propertyUpdatesScheduledForThisPhase,
    ]);

    return getPhaseUpdateParamsFromExistingPhase(phase, {
      propertiesToApply: compiledPropertyUpdates,
    });
  });
}

export function buildPhaseListFromExistingPhasesAndPropertyUpdates(
  existingPhases: Stripe.SubscriptionSchedule.Phase[],
  propertyUpdates: ScheduledPropertyUpdates[]
) {
  const newPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [];

  // Build a list of all timestamps ("bounds") at which we need to split the phases
  const phaseBounds = new Set<number>(
    existingPhases.reduce<number[]>(
      (acc, phase) => [...acc, phase.start_date, phase.end_date],
      []
    )
  );

  const propertyUpdateTimestamps = propertyUpdates.map(
    (update) => update.scheduled_at
  );
  for (const propertyUpdate of propertyUpdates) {
    phaseBounds.add(propertyUpdate.scheduled_at);
  }
  const newPhasesBounds = [...phaseBounds].sort();

  for (let i = 0; i < newPhasesBounds.length - 1; i++) {
    if (newPhasesBounds[i] === newPhasesBounds[i + 1]) {
      throw new Error(`Duplicate phase boundary: ${newPhasesBounds[i]}`);
    }
    const newPhaseBounds = {
      start_date: newPhasesBounds[i],
      end_date: newPhasesBounds[i + 1],
    };

    // Find the latest existing phase that started before the new phase
    // We'll use it as a basis to apply new property changes
    let latestPrecedingPhase = [...existingPhases]
      .reverse()
      .find(
        (existingPhase) => existingPhase.start_date <= newPhaseBounds.start_date
      );

    if (!latestPrecedingPhase) {
      // This means we're scheduling an update before the first existing phase
      // So we'll use the first existing phase as a basis
      latestPrecedingPhase = existingPhases.at(0);
    }

    if (!latestPrecedingPhase) {
      throw new Error(`No previous phase to base the new phase on`);
    }
    newPhases.push(
      getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
        startDate: newPhaseBounds.start_date,
        endDate: newPhaseBounds.end_date,
      })
    );

    // If this phase ends on the last bound, and there is a property update on that bound, we need to add an extra phase
    const isLastPhase = newPhaseBounds.end_date === newPhasesBounds.at(-1);
    const isCurrentPhaseEndingWithAPropertyUpdate =
      propertyUpdateTimestamps.includes(newPhaseBounds.end_date);
    if (isLastPhase && isCurrentPhaseEndingWithAPropertyUpdate) {
      newPhases.push(
        getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
          startDate: newPhaseBounds.end_date,
          endDate: null,
        })
      );
    }
  }

  assertPhasesAreContinuous(newPhases);

  return newPhases;
}

export function printPhases(
  phases:
    | Stripe.SubscriptionScheduleUpdateParams.Phase[]
    | Stripe.SubscriptionSchedule.Phase[]
) {
  let index = 0;
  for (const phase of phases) {
    const start_date =
      phase.start_date === "now"
        ? new Date()
        : new Date((phase.start_date ?? 0) * 1000);
    const end_date =
      phase.end_date === "now"
        ? new Date()
        : phase.end_date
        ? new Date(phase.end_date * 1000)
        : "∞";
    console.log(`Phase #${index} ${start_date} -> ${end_date}`);
    for (const item of phase.items) {
      console.log(`  ${item.plan} x ${item.quantity}`);
    }
    index += 1;
  }
}
