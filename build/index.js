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
  return {
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
function getPhaseUpdateParamsFromExistingPhase(phase, {
  quantity,
  priceOrPlan,
  startDate,
  endDate
} = {}) {
  if (phase.items.length > 1) {
    throw new Error(`We don't support multi-items phases yet`);
  }
  const phaseUpdateParams = convertPhaseToPhaseUpdateParams(phase);
  const phaseItemUpdateParams = convertPhaseItemToUpdateParams(phase.items[0]);
  const result = {
    ...phaseUpdateParams,
    items: [
      {
        ...phaseItemUpdateParams,
        ...priceOrPlan && {
          plan: priceOrPlan,
          price: priceOrPlan
        },
        ...quantity !== undefined && {
          quantity
        }
      }
    ],
    ...startDate && { start_date: startDate },
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
function assertHasNoPastPhases(phases) {
  for (const phase of phases) {
    if (phase.end_date && (phase.end_date === "now" || phase.end_date < new Date().getTime() / 1000)) {
      throw new Error(`Phase ending at "${phase.end_date}" ends now or in the past, it will be rejected by Stripe`);
    }
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
function removePastPhases(phases) {
  return phases.filter((phase) => phase.end_date === undefined || phase.end_date !== "now" && phase.end_date > new Date().getTime() / 1000);
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
      quantity: compiledPropertyUpdates.quantity,
      priceOrPlan: compiledPropertyUpdates.price
    });
  });
}
function buildPhaseListFromExistingPhasesAndPropertyUpdates(existingPhases, propertyUpdates) {
  const newPhases = [];
  const phaseBounds = new Set(existingPhases.reduce((acc, phase) => [...acc, phase.start_date, phase.end_date], []));
  const propertyUpdateTimestamps = propertyUpdates.map((update) => update.scheduled_at);
  for (const propertyUpdate of propertyUpdates) {
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

// src/index.ts
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
  const filteredPhases = removePastPhases(phasesWithUpdatedProperties);
  const finalPhases = mergeAdjacentPhaseUpdates(filteredPhases);
  assertHasNoPastPhases(finalPhases);
  assertPhasesAreContinuous(finalPhases);
  return finalPhases;
}
