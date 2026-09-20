/**
 * Utility functions for evaluating store opening hours.
 */

export interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

/**
 * Checks if the store should currently be open based on the configured weekly schedule.
 * Correctly accounts for overnight shifts (e.g. 18:00 to 02:00) and day-off closures.
 */
export function isStoreCurrentlyOpen(storeHours?: Record<number, DaySchedule>): boolean {
  if (!storeHours || Object.keys(storeHours).length === 0) {
    return true; // Default to open if no schedule has been configured yet
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Check if yesterday's shift ran past midnight into today (e.g., 18:00 to 02:00)
  const prevDay = (currentDay + 6) % 7;
  const prevSchedule = storeHours[prevDay];
  if (prevSchedule && prevSchedule.enabled && prevSchedule.open && prevSchedule.close) {
    const [pOpenH, pOpenM] = prevSchedule.open.split(':').map(Number);
    const [pCloseH, pCloseM] = prevSchedule.close.split(':').map(Number);
    const pOpenMin = pOpenH * 60 + pOpenM;
    const pCloseMin = pCloseH * 60 + pCloseM;

    if (pCloseMin < pOpenMin && currentMinutes < pCloseMin) {
      return true;
    }
  }

  // 2. Check today's schedule
  const daySchedule = storeHours[currentDay];
  if (!daySchedule || !daySchedule.enabled) {
    return false;
  }

  const [openH, openM] = (daySchedule.open || '18:00').split(':').map(Number);
  const [closeH, closeM] = (daySchedule.close || '23:30').split(':').map(Number);
  const openTimeMinutes = openH * 60 + openM;
  const closeTimeMinutes = closeH * 60 + closeM;

  if (closeTimeMinutes < openTimeMinutes) {
    // Overnight shift: open from openTime until midnight (and continues tomorrow early morning)
    return currentMinutes >= openTimeMinutes;
  } else {
    // Regular shift within the same calendar day
    return currentMinutes >= openTimeMinutes && currentMinutes < closeTimeMinutes;
  }
}
