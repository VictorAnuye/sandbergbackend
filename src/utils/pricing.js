import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const HOTEL_TIMEZONE = "Africa/Lagos";


/**
 * Friday, Saturday and Sunday are WEEKEND.
 * Monday through Thursday are WEEKDAY.
 */
export const getRateTypeForDate = (date) => {
  const day = dayjs(date)
    .tz(HOTEL_TIMEZONE)
    .day();

  // Sunday = 0
  // Monday = 1
  // ...
  // Friday = 5
  // Saturday = 6

  if (day === 5 || day === 6 || day === 0) {
    return "WEEKEND";
  }

  return "WEEKDAY";
};


/**
 * Returns the configured room rate.
 *
 * Legacy fallback:
 * If the room does not yet have weekday/weekend prices,
 * pricePerNight is used.
 */
export const getRoomRate = (room, rateType) => {
  if (rateType === "WEEKEND") {
    return Number(
      room.weekend_price ??
      room.pricePerNight ??
      0
    );
  }

  return Number(
    room.weekday_price ??
    room.pricePerNight ??
    0
  );
};


/**
 * Calculate number of nights using the hotel's
 * local calendar.
 */
export const calculateNights = (checkIn, checkOut) => {
  const start = dayjs(checkIn).tz(HOTEL_TIMEZONE);
  const end = dayjs(checkOut).tz(HOTEL_TIMEZONE);

  const nights = end.startOf("day").diff(
    start.startOf("day"),
    "day"
  );

  return Math.max(nights, 1);
};


/**
 * Calculate the price of EVERY individual night.
 *
 * Example:
 *
 * Thursday → Monday
 *
 * Thursday = WEEKDAY
 * Friday   = WEEKEND
 * Saturday = WEEKEND
 * Sunday   = WEEKEND
 */
export const calculateBookingTotal = ({
  room,
  checkIn,
  checkOut,
}) => {
  const start = dayjs(checkIn)
    .tz(HOTEL_TIMEZONE)
    .startOf("day");

  const nights = calculateNights(
    checkIn,
    checkOut
  );

  const breakdown = [];

  let total = 0;

  for (let i = 0; i < nights; i++) {
    const nightDate = start.add(i, "day");

    const rateType = getRateTypeForDate(
      nightDate
    );

    const rate = getRoomRate(
      room,
      rateType
    );

    breakdown.push({
      date: nightDate.toDate(),
      rateType,
      rate,
    });

    total += rate;
  }

  return {
    nights,

    // Compatibility fields.
    // These represent the first night's rate.
    rateType:
      breakdown[0]?.rateType || null,

    rate:
      breakdown[0]?.rate || 0,

    breakdown,

    total,
  };
};


/**
 * Online booking uses the exact same
 * per-night pricing engine.
 */
export const calculateOnlineBookingPrice = ({
  room,
  checkIn,
  checkOut,
}) => {
  return calculateBookingTotal({
    room,
    checkIn,
    checkOut,
  });
};