// utils.ts
function getPhaseUpdateParamsFromExistingPhase(phase, {
  quantity,
  priceOrPlan,
  startDate,
  endDate
} = {}) {
  if (phase.items.length > 1) {
    throw new Error(`We don't support multi-items phases yet`);
  }
  const phaseItem = phase.items[0];
  const planId = typeof phaseItem.plan === "string" ? phaseItem.plan : phaseItem.plan?.id;
  const priceId = typeof phaseItem.price === "string" ? phaseItem.price : phaseItem.price?.id;
  const result = {
    items: [
      {
        plan: priceOrPlan ?? planId,
        price: priceOrPlan ?? priceId,
        quantity: quantity ?? phaseItem.quantity
      }
    ],
    start_date: startDate ?? phase.start_date,
    end_date: endDate === null ? undefined : endDate ?? phase.end_date
  };
  return result;
}
function assertPhasesAreContinuous(phases) {
  let lastPhaseEndDate;
  for (const phase of phases) {
    if (lastPhaseEndDate) {
      if (phase.start_date !== lastPhaseEndDate) {
        throw new Error(`Schedule continuity error: there is a gap between ${lastPhaseEndDate} and ${phase.start_date}`);
      }
    }
    lastPhaseEndDate = phase.end_date;
  }
}
function mergeAdjacentPhaseUpdates(phases) {
  const mergedPhases = [];
  let previousPhase;
  for (const phase of phases) {
    if (previousPhase && previousPhase.items[0].plan === phase.items[0].plan && previousPhase.items[0].price === phase.items[0].price && previousPhase.items[0].quantity === phase.items[0].quantity) {
      previousPhase.end_date = phase.end_date;
    } else {
      mergedPhases.push(phase);
      previousPhase = phase;
    }
  }
  return mergedPhases;
}
function compilePropertyUpdates(propertyUpdates) {
  const result = propertyUpdates.reduce((acc, propertyUpdate) => ({ ...acc, ...propertyUpdate }), propertyUpdates[0]);
  return result;
}
function applyPropertyUpdatesOnNewPhases(phasesList, propertyUpdates) {
  let compiledPropertyUpdates = {
    scheduled_at: 0
  };
  return phasesList.map((phase) => {
    const propertyUpdatesScheduledForThisPhase = propertyUpdates.filter((propertyUpdate) => propertyUpdate.scheduled_at === phase.start_date);
    compiledPropertyUpdates = compilePropertyUpdates([
      compiledPropertyUpdates,
      ...propertyUpdatesScheduledForThisPhase
    ]);
    return getPhaseUpdateParamsFromExistingPhase(phase, {
      quantity: compiledPropertyUpdates.newQuantity,
      priceOrPlan: compiledPropertyUpdates.newPrice
    });
  });
}
function buildPhaseListFromExistingPhasesAndPropertyUpdates(existingPhases, propertyUpdates) {
  const newPhases = [];
  const phaseBounds = new Set(existingPhases.reduce((acc, phase) => [...acc, phase.start_date, phase.end_date], []));
  const propertyUpdateTimestamps = propertyUpdates.map((update) => update.scheduled_at);
  for (const propertyUpdate of propertyUpdates) {
    if (propertyUpdate.scheduled_at < new Date().getTime() / 1000) {
      throw new Error(`Can't schedule property update in the past`);
    }
    phaseBounds.add(propertyUpdate.scheduled_at);
  }
  const newPhasesBounds = [...phaseBounds].sort();
  for (let i = 0;i < newPhasesBounds.length - 1; i++) {
    if (newPhasesBounds[i] === newPhasesBounds[i + 1]) {
      throw new Error(`Duplicate phase boundary: ${newPhasesBounds[i]}`);
    }
    const newPhaseBounds = {
      start_date: newPhasesBounds[i],
      end_date: newPhasesBounds[i + 1]
    };
    const latestPrecedingPhase = existingPhases.toReversed().find((existingPhase) => existingPhase.start_date <= newPhaseBounds.start_date);
    if (!latestPrecedingPhase) {
      throw new Error(`No previous phase to base the new phase on`);
    }
    newPhases.push(getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
      startDate: newPhaseBounds.start_date,
      endDate: newPhaseBounds.end_date
    }));
    const isLastPhase = newPhaseBounds.end_date === newPhasesBounds.at(-1);
    const isCurrentPhaseEndingWithAPropertyUpdate = propertyUpdateTimestamps.includes(newPhaseBounds.end_date);
    if (isLastPhase && isCurrentPhaseEndingWithAPropertyUpdate) {
      newPhases.push(getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
        startDate: newPhaseBounds.end_date,
        endDate: null
      }));
    }
  }
  assertPhasesAreContinuous(newPhases);
  return newPhases;
}

// index.ts
function scheduleSubscriptionUpdates({
  propertyUpdates,
  existingPhases
}) {
  if (propertyUpdates.length === 0) {
    if (!existingPhases) {
      throw new Error("No property updates to apply and no existing phases");
    }
    return existingPhases.map((phase) => getPhaseUpdateParamsFromExistingPhase(phase));
  }
  propertyUpdates.sort((a, b) => a.scheduled_at - b.scheduled_at);
  const newPhases = buildPhaseListFromExistingPhasesAndPropertyUpdates(existingPhases ?? [], propertyUpdates);
  const phasesWithUpdatedProperties = applyPropertyUpdatesOnNewPhases(newPhases, propertyUpdates);
  return mergeAdjacentPhaseUpdates(phasesWithUpdatedProperties);
}
export {
  scheduleSubscriptionUpdates
};
