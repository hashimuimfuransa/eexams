// Shared duration resolution for admin-editable plan catalogs (SubscriptionPlan,
// OrganizationPlan, IndividualPlan). Every downstream expiry calculation keys off
// durationDays (fractional when the admin picked hours), so durationValue/
// durationUnit are stored alongside purely to let the super-admin UI redisplay
// and re-edit the value in the unit it was entered in (e.g. "12 hours" instead
// of "0.5 days").
// Multiplier to convert one unit of durationValue into days.
const UNIT_TO_DAYS = { hours: 1 / 24, days: 1, weeks: 7, months: 30 };

const resolvePlanDuration = ({ durationValue, durationUnit, durationDays }) => {
  if (durationValue !== undefined && durationValue !== null && durationValue !== '') {
    const unit = UNIT_TO_DAYS[durationUnit] ? durationUnit : 'days';
    const value = Number(durationValue);
    if (!Number.isFinite(value) || value <= 0) return null;
    return {
      durationValue: value,
      durationUnit: unit,
      durationDays: value * UNIT_TO_DAYS[unit]
    };
  }

  // Back-compat: callers that still send a raw durationDays (no unit picker).
  if (durationDays !== undefined && durationDays !== null && durationDays !== '') {
    const value = Number(durationDays);
    if (!Number.isFinite(value) || value <= 0) return null;
    return { durationValue: value, durationUnit: 'days', durationDays: value };
  }

  return null;
};

module.exports = { resolvePlanDuration };
