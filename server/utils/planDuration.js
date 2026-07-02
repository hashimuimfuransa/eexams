// Shared duration resolution for admin-editable plan catalogs (SubscriptionPlan,
// OrganizationPlan, IndividualPlan). Every downstream expiry calculation keys off
// durationDays (fractional when the admin picked hours), so durationValue/
// durationUnit are stored alongside purely to let the super-admin UI redisplay
// and re-edit the value in the unit it was entered in (e.g. "12 hours" instead
// of "0.5 days").
const resolvePlanDuration = ({ durationValue, durationUnit, durationDays }) => {
  if (durationValue !== undefined && durationValue !== null && durationValue !== '') {
    const unit = durationUnit === 'hours' ? 'hours' : 'days';
    const value = Number(durationValue);
    if (!Number.isFinite(value) || value <= 0) return null;
    return {
      durationValue: value,
      durationUnit: unit,
      durationDays: unit === 'hours' ? value / 24 : value
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
