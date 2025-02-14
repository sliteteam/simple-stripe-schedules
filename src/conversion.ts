import type Stripe from "stripe";

/**
 * Returns a new UpdateParams.Phase pbject replicating the input phase
 * When updating schedule phases, we need to pass all the fields again, hence the need for this function
 * @param phase
 * @returns update params matching the phase
 */
export function convertPhaseToPhaseUpdateParams(
  phase:
    | Stripe.SubscriptionSchedule.Phase
    | Stripe.SubscriptionScheduleUpdateParams.Phase
): Omit<Stripe.SubscriptionScheduleUpdateParams.Phase, "items"> {
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
    // The rest of the fields can be passed as-is in the update
    ...restOfFields
  } = phase;

  const couponId = typeof coupon === "string" ? coupon : coupon?.id;
  const defaultPaymentMethodId =
    typeof default_payment_method === "string"
      ? default_payment_method
      : default_payment_method?.id;
  const defaultTaxRateIds =
    default_tax_rates &&
    default_tax_rates.map((taxRate) =>
      typeof taxRate === "string" ? taxRate : taxRate.id
    );
  const newDiscounts =
    discounts && discounts.filter((discount) => typeof discount === "string");
  const newOnBehalfOf =
    typeof on_behalf_of === "string" ? on_behalf_of : on_behalf_of?.id;

  return {
    ...restOfFields,
    coupon: couponId,
    add_invoice_items:
      add_invoice_items &&
      convertAddInvoiceItemsToUpdateParams(add_invoice_items),
    application_fee_percent: application_fee_percent ?? undefined,
    automatic_tax:
      automatic_tax && convertAutomaticTaxToUpdateParams(automatic_tax),
    billing_cycle_anchor: billing_cycle_anchor ?? undefined,
    billing_thresholds:
      billing_thresholds &&
      convertBillingThresholdsToUpdateParams(billing_thresholds),
    collection_method: collection_method ?? undefined,
    default_payment_method: defaultPaymentMethodId,
    default_tax_rates: defaultTaxRateIds,
    discounts: newDiscounts,
    invoice_settings:
      (invoice_settings &&
        convertInvoiceSettingsToUpdateParams(invoice_settings)) ??
      undefined,
    metadata: metadata ?? undefined,
    on_behalf_of: newOnBehalfOf,
    transfer_data:
      (transfer_data && convertTransferDataToUpdateParams(transfer_data)) ??
      undefined,
    trial_end: trial_end ?? undefined,
  };
}

function convertTransferDataToUpdateParams(
  transfer_data:
    | Stripe.SubscriptionSchedule.Phase.TransferData
    | Stripe.SubscriptionScheduleUpdateParams.Phase.TransferData
): Stripe.SubscriptionScheduleUpdateParams.Phase.TransferData {
  return {
    destination:
      typeof transfer_data.destination === "string"
        ? transfer_data.destination
        : transfer_data.destination?.id,
  };
}

function convertAddInvoiceItemsToUpdateParams(
  add_invoice_items:
    | Stripe.SubscriptionSchedule.Phase.AddInvoiceItem[]
    | Stripe.SubscriptionScheduleUpdateParams.Phase.AddInvoiceItem[]
): Stripe.SubscriptionScheduleUpdateParams.Phase.AddInvoiceItem[] {
  return add_invoice_items.map((invoiceItem) => {
    const { price, quantity, tax_rates, discounts, ...rest } = invoiceItem;
    return {
      price: typeof price === "string" ? price : price?.id,
      quantity: quantity ?? undefined,
      discounts: invoiceItem.discounts?.filter(
        (discount) => typeof discount === "string"
      ),
      tax_rates:
        typeof tax_rates === "string"
          ? tax_rates
          : tax_rates?.map((taxRate) =>
              typeof taxRate === "string" ? taxRate : taxRate.id
            ),
      ...rest,
    };
  });
}

function convertInvoiceSettingsToUpdateParams(
  invoice_settings:
    | Stripe.SubscriptionSchedule.Phase.InvoiceSettings
    | Stripe.SubscriptionScheduleUpdateParams.Phase.InvoiceSettings
): Stripe.SubscriptionScheduleUpdateParams.Phase.InvoiceSettings {
  const { account_tax_ids, days_until_due, issuer, ...rest } = invoice_settings;
  return {
    ...rest,
    account_tax_ids:
      typeof account_tax_ids === "string"
        ? account_tax_ids
        : account_tax_ids?.map((taxId) =>
            typeof taxId === "string" ? taxId : taxId.id
          ),
    days_until_due: days_until_due ?? undefined,
    issuer: issuer
      ? {
          ...issuer,
          account:
            typeof issuer.account === "string"
              ? issuer.account
              : issuer.account?.id,
        }
      : undefined,
  };
}

function convertBillingThresholdsToUpdateParams(
  billing_thresholds:
    | Stripe.SubscriptionSchedule.Phase.BillingThresholds
    | Stripe.SubscriptionScheduleUpdateParams.Phase.BillingThresholds
): Stripe.SubscriptionScheduleUpdateParams.Phase.BillingThresholds {
  return {
    amount_gte: billing_thresholds.amount_gte ?? undefined,
    reset_billing_cycle_anchor:
      billing_thresholds.reset_billing_cycle_anchor ?? undefined,
  };
}

// Received unknown parameter: phases[0][automatic_tax][disabled_reason]

function convertAutomaticTaxToUpdateParams(
  automatic_tax:
    | Stripe.SubscriptionSchedule.Phase.AutomaticTax
    | Stripe.SubscriptionScheduleUpdateParams.Phase.AutomaticTax
): Stripe.SubscriptionScheduleUpdateParams.Phase.AutomaticTax {
  const liability = {
    ...automatic_tax.liability,
    account: automatic_tax.liability?.account ?? undefined,
  };
  const account =
    typeof liability.account === "string"
      ? liability.account
      : liability.account?.id;
  return {
    ...automatic_tax,
    // @ts-ignore
    disabled_reason: undefined,
    liability: {
      ...automatic_tax.liability,
      account,
      type: "account",
    },
  };
}

export function convertPhaseItemToUpdateParams(
  item:
    | Stripe.SubscriptionSchedule.Phase.Item
    | Stripe.SubscriptionScheduleUpdateParams.Phase.Item
): Stripe.SubscriptionScheduleUpdateParams.Phase.Item {
  const {
    plan,
    price,
    billing_thresholds,
    discounts,
    metadata,
    tax_rates,
    // The rest of the fields can be passed as-is in the update
    ...restOfFields
  } = item;

  return {
    ...restOfFields,
    plan: typeof plan === "string" ? plan : plan?.id,
    price: typeof price === "string" ? price : price?.id,
    billing_thresholds:
      typeof billing_thresholds === "string" ? billing_thresholds : undefined,
    discounts:
      typeof discounts === "string"
        ? discounts
        : discounts?.filter((discount) => typeof discount === "string"),
    metadata: metadata ?? undefined,
    tax_rates:
      typeof tax_rates === "string"
        ? tax_rates
        : tax_rates?.map((taxRate) =>
            typeof taxRate === "string" ? taxRate : taxRate.id
          ),
  };
}
