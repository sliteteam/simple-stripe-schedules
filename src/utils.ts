import type Stripe from "stripe";
import {
	convertPhaseItemToUpdateParams,
	convertPhaseToPhaseUpdateParams,
} from "./conversion";
import type { ScheduledPropertyUpdates } from "./types";

function getItemPriceId(
	item:
		| Stripe.SubscriptionSchedule.Phase.Item
		| Stripe.SubscriptionScheduleUpdateParams.Phase.Item,
): string | undefined {
	const { plan, price } = item;
	const priceId = typeof price === "string" ? price : price?.id;
	const planId = typeof plan === "string" ? plan : plan?.id;
	return priceId ?? planId;
}

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
	} = {},
): Stripe.SubscriptionScheduleUpdateParams.Phase {
	const phaseUpdateParams = convertPhaseToPhaseUpdateParams(phase);

	const { subscriptionItemId, price, quantity, proration_behavior } =
		propertiesToApply ?? {};

	const hasItemLevelUpdate = price !== undefined || quantity !== undefined;

	if (hasItemLevelUpdate && phase.items.length > 1 && !subscriptionItemId) {
		throw new Error(
			`Phase has multiple items but no subscriptionItemId was provided to target the update`,
		);
	}

	if (subscriptionItemId && hasItemLevelUpdate) {
		const matchingItem = phase.items.find(
			(item) => getItemPriceId(item) === subscriptionItemId,
		);
		if (!matchingItem) {
			throw new Error(
				`No item matching subscriptionItemId "${subscriptionItemId}" in phase`,
			);
		}
	}

	const items = phase.items.map((item) => {
		const itemParams = convertPhaseItemToUpdateParams(item);
		const isTargetItem =
			phase.items.length === 1 && !subscriptionItemId
				? true
				: getItemPriceId(item) === subscriptionItemId;
		if (!isTargetItem) {
			return itemParams;
		}
		return {
			...itemParams,
			...(price && {
				plan: price,
				price: price,
			}),
			...(quantity !== undefined && {
				quantity,
			}),
		};
	});

	const result = {
		...phaseUpdateParams,
		items,
		...(startDate && { start_date: startDate }),
		end_date: endDate === null ? undefined : (endDate ?? phase.end_date),
		...(proration_behavior && { proration_behavior }),
	};
	return result;
}

export function assertPhasesAreContinuous(
	phases: Pick<
		Stripe.SubscriptionScheduleUpdateParams.Phase,
		"end_date" | "start_date"
	>[],
) {
	let lastPhaseEndDate: number | "now" | undefined;
	for (const phase of phases) {
		if (lastPhaseEndDate) {
			if (phase.start_date !== lastPhaseEndDate) {
				throw new Error(
					`Schedule continuity error: there is a gap between ${lastPhaseEndDate} and ${phase.start_date}`,
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
	>[],
) {
	for (const phase of phases) {
		if (
			phase.end_date &&
			(phase.end_date === "now" || phase.end_date < new Date().getTime() / 1000)
		) {
			throw new Error(
				`Phase ending at "${phase.end_date}" ends now or in the past, it will be rejected by Stripe`,
			);
		}
	}
}

function haveSameItems(
	a: Stripe.SubscriptionScheduleUpdateParams.Phase,
	b: Stripe.SubscriptionScheduleUpdateParams.Phase,
): boolean {
	if (a.items.length !== b.items.length) {
		return false;
	}
	return a.items.every((itemA, index) => {
		const itemB = b.items[index];
		return (
			getItemPriceId(itemA) === getItemPriceId(itemB) &&
			itemA.quantity === itemB.quantity
		);
	});
}

/**
 * Merges adjacent phases that have the same properties
 * @param phases
 */
export function mergeAdjacentPhaseUpdates(
	phases: Stripe.SubscriptionScheduleUpdateParams.Phase[],
): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
	const mergedPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [];
	let previousPhase: Stripe.SubscriptionScheduleUpdateParams.Phase | undefined;
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

/**
 * Returns an array of phases, without already past phases
 * @param phases
 */
export function removePastPhases(
	phases: Stripe.SubscriptionScheduleUpdateParams.Phase[],
): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
	return phases.filter(
		(phase) =>
			phase.end_date === undefined ||
			(phase.end_date !== "now" &&
				phase.end_date > new Date().getTime() / 1000),
	);
}

export function compilePropertyUpdates(
	propertyUpdates: ScheduledPropertyUpdates[],
) {
	const result = propertyUpdates.reduce(
		(acc, propertyUpdate) => ({ ...acc, ...propertyUpdate }),
		propertyUpdates[0],
	);
	return result;
}

/**
 * Groups property updates by their target subscription item (or a single "all items"
 * bucket when no subscriptionItemId is provided), then compiles each group so the
 * latest update per item wins. Updates to distinct items remain independent.
 */
function compilePropertyUpdatesPerItem(
	propertyUpdates: ScheduledPropertyUpdates[],
): ScheduledPropertyUpdates[] {
	const groups = new Map<string, ScheduledPropertyUpdates[]>();
	for (const update of propertyUpdates) {
		const key = update.subscriptionItemId ?? "__all__";
		const existing = groups.get(key);
		if (existing) {
			existing.push(update);
		} else {
			groups.set(key, [update]);
		}
	}
	return [...groups.values()].map((group) => compilePropertyUpdates(group));
}

export function applyPropertyUpdatesOnNewPhases(
	phasesList: Stripe.SubscriptionScheduleUpdateParams.Phase[],
	propertyUpdates: ScheduledPropertyUpdates[],
) {
	const activePropertiesPerItem = new Map<string, ScheduledPropertyUpdates>();
	return phasesList.map((phase) => {
		// Apply any property updates scheduled at the beginning of this phase,
		// grouped per target item so updates to distinct items don't overwrite each other.
		const updatesForThisPhase = propertyUpdates.filter(
			(propertyUpdate) => propertyUpdate.scheduled_at === phase.start_date,
		);
		const compiledUpdatesForThisPhase =
			compilePropertyUpdatesPerItem(updatesForThisPhase);
		for (const update of compiledUpdatesForThisPhase) {
			const key = update.subscriptionItemId ?? "__all__";
			const existing = activePropertiesPerItem.get(key) ?? {
				scheduled_at: 0,
			};
			activePropertiesPerItem.set(key, { ...existing, ...update });
		}

		let updatedPhase = phase;
		for (const propertiesToApply of activePropertiesPerItem.values()) {
			updatedPhase = getPhaseUpdateParamsFromExistingPhase(updatedPhase, {
				propertiesToApply,
			});
		}
		return updatedPhase;
	});
}

export function buildPhaseListFromExistingPhasesAndPropertyUpdates(
	existingPhases: Stripe.SubscriptionSchedule.Phase[],
	propertyUpdates: ScheduledPropertyUpdates[],
	cancelAt?: number,
	end_behavior?: Stripe.SubscriptionSchedule.EndBehavior | null,
) {
	const newPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [];

	// Build a list of all timestamps ("bounds") at which we need to split the phases
	const phaseBounds = new Set<number>(
		existingPhases.reduce<number[]>(
			(acc, phase) => [...acc, phase.start_date, phase.end_date],
			[],
		),
	);

	// The cancellation timestamp will be a phase end
	if (cancelAt) {
		phaseBounds.add(cancelAt);
	}

	const propertyUpdateTimestamps = propertyUpdates.map(
		(update) => update.scheduled_at,
	);
	for (const propertyUpdate of propertyUpdates) {
		phaseBounds.add(propertyUpdate.scheduled_at);
	}
	let newPhasesBounds = [...phaseBounds].sort();

	// Drop any phase existing after cancellation
	if (cancelAt) {
		newPhasesBounds = newPhasesBounds.filter((bound) => bound <= cancelAt);
	}

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
				(existingPhase) =>
					existingPhase.start_date <= newPhaseBounds.start_date,
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
			}),
		);

		// If this phase ends on the last bound, and there is a property update on that bound, we need to add an extra phase
		const isLastPhase = newPhaseBounds.end_date === newPhasesBounds.at(-1);
		const isCurrentPhaseEndingWithAPropertyUpdate =
			propertyUpdateTimestamps.includes(newPhaseBounds.end_date);
		const isCurrentPhaseEndingWithCancellation =
			newPhaseBounds.end_date === cancelAt ||
			(end_behavior === "cancel" && isLastPhase);
		if (
			isLastPhase &&
			isCurrentPhaseEndingWithAPropertyUpdate &&
			!isCurrentPhaseEndingWithCancellation
		) {
			newPhases.push(
				getPhaseUpdateParamsFromExistingPhase(latestPrecedingPhase, {
					startDate: newPhaseBounds.end_date,
					endDate: null,
				}),
			);
		}
	}

	assertPhasesAreContinuous(newPhases);

	return newPhases;
}

export function printPhases(
	phases:
		| Stripe.SubscriptionScheduleUpdateParams.Phase[]
		| Stripe.SubscriptionSchedule.Phase[],
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
