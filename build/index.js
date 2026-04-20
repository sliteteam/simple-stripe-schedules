var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  scheduleSubscriptionUpdates: () => scheduleSubscriptionUpdates
});
module.exports = __toCommonJS(exports_src);

// src/conversion.ts
function convertPhaseToPhaseUpdateParams(phase) {
  const {
    items,
    coupon,
    add_invoice_items,
    application_fee_percent,
    automatic_tax,
    billing_cycle_anchor,
    billing_thresholds,
    collection_method,
    default_payment_method,
    default_tax_rates,
    discounts,
    invoice_settings,
    metadata,
    on_behalf_of,
    transfer_data,
    trial_end,
    ...restOfFields
  } = phase;
  const couponId = typeof coupon === "string" ? coupon : coupon?.id;
  const defaultPaymentMethodId = typeof default_payment_method === "string" ? default_payment_method : default_payment_method?.id;
  const defaultTaxRateIds = default_tax_rates && default_tax_rates.map((taxRate) => typeof taxRate === "string" ? taxRate : taxRate.id);
  const newDiscounts = discounts && discounts.filter((discount) => typeof discount === "string");
  const newOnBehalfOf = typeof on_behalf_of === "string" ? on_behalf_of : on_behalf_of?.id;
  const output = {
    ...restOfFields,
    coupon: couponId,
    add_invoice_items: add_invoice_items && convertAddInvoiceItemsToUpdateParams(add_invoice_items),
    application_fee_percent: application_fee_percent ?? undefined,
    automatic_tax: automatic_tax && convertAutomaticTaxToUpdateParams(automatic_tax),
    billing_cycle_anchor: billing_cycle_anchor ?? undefined,
    billing_thresholds: billing_thresholds && convertBillingThresholdsToUpdateParams(billing_thresholds),
    collection_method: collection_method ?? undefined,
    default_payment_method: defaultPaymentMethodId,
    default_tax_rates: defaultTaxRateIds,
    discounts: newDiscounts,
    invoice_settings: (invoice_settings && convertInvoiceSettingsToUpdateParams(invoice_settings)) ?? undefined,
    metadata: metadata ?? undefined,
    on_behalf_of: newOnBehalfOf,
    transfer_data: (transfer_data && convertTransferDataToUpdateParams(transfer_data)) ?? undefined,
    trial_end: trial_end ?? undefined
  };
  if (output.trial) {
    delete output.trial_end;
  }
  return output;
}
function convertTransferDataToUpdateParams(transfer_data) {
  return {
    destination: typeof transfer_data.destination === "string" ? transfer_data.destination : transfer_data.destination?.id
  };
}
function convertAddInvoiceItemsToUpdateParams(add_invoice_items) {
  return add_invoice_items.map((invoiceItem) => {
    const { price, quantity, tax_rates, discounts, ...rest } = invoiceItem;
    return {
      price: typeof price === "string" ? price : price?.id,
      quantity: quantity ?? undefined,
      discounts: invoiceItem.discounts?.filter((discount) => typeof discount === "string"),
      tax_rates: typeof tax_rates === "string" ? tax_rates : tax_rates?.map((taxRate) => typeof taxRate === "string" ? taxRate : taxRate.id),
      ...rest
    };
  });
}
function convertInvoiceSettingsToUpdateParams(invoice_settings) {
  const { account_tax_ids, days_until_due, issuer, ...rest } = invoice_settings;
  return {
    ...rest,
    account_tax_ids: typeof account_tax_ids === "string" ? account_tax_ids : account_tax_ids?.map((taxId) => typeof taxId === "string" ? taxId : taxId.id),
    days_until_due: days_until_due ?? undefined,
    issuer: issuer ? {
      ...issuer,
      account: typeof issuer.account === "string" ? issuer.account : issuer.account?.id
    } : undefined
  };
}
function convertBillingThresholdsToUpdateParams(billing_thresholds) {
  return {
    amount_gte: billing_thresholds.amount_gte ?? undefined,
    reset_billing_cycle_anchor: billing_thresholds.reset_billing_cycle_anchor ?? undefined
  };
}
function convertAutomaticTaxToUpdateParams(automatic_tax) {
  const liability = {
    ...automatic_tax.liability,
    account: automatic_tax.liability?.account ?? undefined
  };
  const account = typeof liability.account === "string" ? liability.account : liability.account?.id;
  return {
    ...automatic_tax,
    disabled_reason: undefined,
    liability: {
      ...automatic_tax.liability,
      account
    }
  };
}
function convertPhaseItemToUpdateParams(item) {
  const {
    plan,
    price,
    billing_thresholds,
    discounts,
    metadata,
    tax_rates,
    ...restOfFields
  } = item;
  return {
    ...restOfFields,
    plan: typeof plan === "string" ? plan : plan?.id,
    price: typeof price === "string" ? price : price?.id,
    billing_thresholds: typeof billing_thresholds === "string" ? billing_thresholds : undefined,
    discounts: typeof discounts === "string" ? discounts : discounts?.filter((discount) => typeof discount === "string"),
    metadata: metadata ?? undefined,
    tax_rates: typeof tax_rates === "string" ? tax_rates : tax_rates?.map((taxRate) => typeof taxRate === "string" ? taxRate : taxRate.id)
  };
}

// src/utils.ts
function getItemPriceId(item) {
  const { plan, price } = item;
  const priceId = typeof price === "string" ? price : price?.id;
  const planId = typeof plan === "string" ? plan : plan?.id;
  return priceId ?? planId;
}
function getPhaseUpdateParamsFromExistingPhase(phase, {
  propertiesToApply,
  startDate,
  endDate
} = {}) {
  const phaseUpdateParams = convertPhaseToPhaseUpdateParams(phase);
  const { itemIndex, price, quantity, proration_behavior } = propertiesToApply ?? {};
  const hasItemLevelUpdate = price !== undefined || quantity !== undefined;
  if (hasItemLevelUpdate && phase.items.length > 1 && itemIndex === undefined) {
    throw new Error(`Phase has multiple items but no itemIndex was provided to target the update`);
  }
  if (itemIndex !== undefined && hasItemLevelUpdate) {
    if (itemIndex < 0 || itemIndex >= phase.items.length) {
      throw new Error(`itemIndex ${itemIndex} is out of bounds for phase with ${phase.items.length} item(s)`);
    }
  }
  const items = phase.items.map((item, index) => {
    const itemParams = convertPhaseItemToUpdateParams(item);
    const isTargetItem = phase.items.length === 1 && itemIndex === undefined ? true : index === itemIndex;
    if (!isTargetItem) {
      return itemParams;
    }
    return {
      ...itemParams,
      ...price && {
        plan: price,
        price
      },
      ...quantity !== undefined && {
        quantity
      }
    };
  });
  const result = {
    ...phaseUpdateParams,
    items,
    ...startDate && { start_date: startDate },
    end_date: endDate === null ? undefined : endDate ?? phase.end_date,
    ...proration_behavior && { proration_behavior }
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
function assertCurrentAndFuturePhasesHaveConsistentItemCount(phases) {
  const now = Date.now() / 1000;
  const relevantPhases = phases.filter((phase) => !phase.end_date || phase.end_date > now);
  if (relevantPhases.length === 0) {
    return;
  }
  const expectedCount = relevantPhases[0].items.length;
  for (const phase of relevantPhases) {
    if (phase.items.length !== expectedCount) {
      throw new Error(`Current and future phases must all have the same number of items (expected ${expectedCount}, got ${phase.items.length})`);
    }
  }
}
function assertItemIndexInBounds(propertyUpdates, itemCount) {
  for (const update of propertyUpdates) {
    if (update.itemIndex === undefined) {
      continue;
    }
    if (update.itemIndex < 0 || update.itemIndex >= itemCount) {
      throw new Error(`itemIndex ${update.itemIndex} is out of bounds for phases with ${itemCount} item(s)`);
    }
  }
}
function assertHasNoPastPhases(phases) {
  for (const phase of phases) {
    if (phase.end_date && (phase.end_date === "now" || phase.end_date < new Date().getTime() / 1000)) {
      throw new Error(`Phase ending at "${phase.end_date}" ends now or in the past, it will be rejected by Stripe`);
    }
  }
}
function haveSameItems(a, b) {
  if (a.items.length !== b.items.length) {
    return false;
  }
  const bQuantitiesByPriceId = new Map;
  for (const itemB of b.items) {
    const priceId = getItemPriceId(itemB);
    if (priceId === undefined) {
      return false;
    }
    bQuantitiesByPriceId.set(priceId, itemB.quantity);
  }
  return a.items.every((itemA) => {
    const priceId = getItemPriceId(itemA);
    if (priceId === undefined || !bQuantitiesByPriceId.has(priceId)) {
      return false;
    }
    return bQuantitiesByPriceId.get(priceId) === itemA.quantity;
  });
}
function mergeAdjacentPhaseUpdates(phases) {
  const mergedPhases = [];
  let previousPhase;
  for (const phase of phases) {
    if (previousPhase && haveSameItems(previousPhase, phase)) {
      previousPhase.end_date = phase.end_date;
    } else {
      mergedPhases.push(phase);
      previousPhase = phase;
    }
  }
  return mergedPhases;
}
function removePastPhases(phases) {
  return phases.filter((phase) => phase.end_date === undefined || phase.end_date !== "now" && phase.end_date > new Date().getTime() / 1000);
}
function compilePropertyUpdates(propertyUpdates) {
  const result = propertyUpdates.reduce((acc, propertyUpdate) => ({ ...acc, ...propertyUpdate }), propertyUpdates[0]);
  return result;
}
function compilePropertyUpdatesPerItem(propertyUpdates) {
  const groups = new Map;
  for (const update of propertyUpdates) {
    const existing = groups.get(update.itemIndex);
    if (existing) {
      existing.push(update);
    } else {
      groups.set(update.itemIndex, [update]);
    }
  }
  return [...groups.values()].map((group) => compilePropertyUpdates(group));
}
function applyPropertyUpdatesOnNewPhases(phasesList, propertyUpdates) {
  const activePropertiesPerItem = new Map;
  return phasesList.map((phase) => {
    const updatesForThisPhase = propertyUpdates.filter((propertyUpdate) => propertyUpdate.scheduled_at === phase.start_date);
    const compiledUpdatesForThisPhase = compilePropertyUpdatesPerItem(updatesForThisPhase);
    for (const update of compiledUpdatesForThisPhase) {
      const existing = activePropertiesPerItem.get(update.itemIndex) ?? {
        scheduled_at: 0,
        itemIndex: update.itemIndex
      };
      activePropertiesPerItem.set(update.itemIndex, {
        ...existing,
        ...update
      });
    }
    let updatedPhase = phase;
    for (const propertiesToApply of activePropertiesPerItem.values()) {
      updatedPhase = getPhaseUpdateParamsFromExistingPhase(updatedPhase, {
        propertiesToApply
      });
    }
    return updatedPhase;
  });
}
function buildPhaseListFromExistingPhasesAndPropertyUpdates(existingPhases, propertyUpdates, cancelAt, end_behavior) {
  const newPhases = [];
  const phaseBounds = new Set(existingPhases.reduce((acc, phase) => [...acc, phase.start_date, phase.end_date], []));
  if (cancelAt) {
    phaseBounds.add(cancelAt);
  }
  const propertyUpdateTimestamps = propertyUpdates.map((update) => update.scheduled_at);
  for (const propertyUpdate of propertyUpdates) {
    phaseBounds.add(propertyUpdate.scheduled_at);
  }
  let newPhasesBounds = [...phaseBounds].sort();
  if (cancelAt) {
    newPhasesBounds = newPhasesBounds.filter((bound) => bound <= cancelAt);
  }
  for (let i = 0;i < newPhasesBounds.length - 1; i++) {
    if (newPhasesBounds[i] === newPhasesBounds[i + 1]) {
      throw new Error(`Duplicate phase boundary: ${newPhasesBounds[i]}`);
    }
    const newPhaseBounds = {
      start_date: newPhasesBounds[i],
      end_date: newPhasesBounds[i + 1]
    };
    let latestPrecedingPhase = [...existingPhases].reverse().find((existingPhase) => existingPhase.start_date <= newPhaseBounds.start_date);
    if (!latestPrecedingPhase) {
      latestPrecedingPhase = existingPhases.at(0);
    }
    if (!latestPrecedingPhase) {
      throw new Error(`No previous phase to base the new phase on`);
    }
    newPhases.push(getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
      startDate: newPhaseBounds.start_date,
      endDate: newPhaseBounds.end_date
    }));
    const isLastPhase = newPhaseBounds.end_date === newPhasesBounds.at(-1);
    const isCurrentPhaseEndingWithAPropertyUpdate = propertyUpdateTimestamps.includes(newPhaseBounds.end_date);
    const isCurrentPhaseEndingWithCancellation = newPhaseBounds.end_date === cancelAt || end_behavior === "cancel" && isLastPhase;
    if (isLastPhase && isCurrentPhaseEndingWithAPropertyUpdate && !isCurrentPhaseEndingWithCancellation) {
      newPhases.push(getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
        startDate: newPhaseBounds.end_date,
        endDate: null
      }));
    }
  }
  assertPhasesAreContinuous(newPhases);
  return newPhases;
}

// src/index.ts
function scheduleSubscriptionUpdates(schedule, {
  propertyUpdates,
  cancelAt
}) {
  const { phases: existingPhases, end_behavior } = schedule;
  if (existingPhases) {
    assertCurrentAndFuturePhasesHaveConsistentItemCount(existingPhases);
  }
  const now = Date.now() / 1000;
  const firstRelevantPhase = existingPhases?.find((phase) => !phase.end_date || phase.end_date > now);
  const normalizedPropertyUpdates = propertyUpdates?.map((update) => {
    if (update.itemIndex !== undefined) {
      return { ...update, itemIndex: update.itemIndex };
    }
    if (firstRelevantPhase && firstRelevantPhase.items.length > 1) {
      throw new Error(`Phase has multiple items but no itemIndex was provided to target the update`);
    }
    return { ...update, itemIndex: 0 };
  });
  if (firstRelevantPhase && normalizedPropertyUpdates?.length) {
    assertItemIndexInBounds(normalizedPropertyUpdates, firstRelevantPhase.items.length);
  }
  if (!normalizedPropertyUpdates?.length && !cancelAt) {
    if (!existingPhases) {
      throw new Error("Nothing to schedule and no existing phases");
    }
    return existingPhases.map((phase) => getPhaseUpdateParamsFromExistingPhase(phase));
  }
  normalizedPropertyUpdates?.sort((a, b) => a.scheduled_at - b.scheduled_at);
  const newPhases = buildPhaseListFromExistingPhasesAndPropertyUpdates(existingPhases ?? [], normalizedPropertyUpdates ?? [], cancelAt, end_behavior);
  const phasesWithUpdatedProperties = applyPropertyUpdatesOnNewPhases(newPhases, normalizedPropertyUpdates ?? []);
  const filteredPhases = removePastPhases(phasesWithUpdatedProperties);
  const finalPhases = mergeAdjacentPhaseUpdates(filteredPhases);
  assertHasNoPastPhases(finalPhases);
  assertPhasesAreContinuous(finalPhases);
  return finalPhases;
}
