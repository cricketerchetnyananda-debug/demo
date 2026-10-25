/** Shared input formats used across DTOs. */
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const DATE_MESSAGE = 'Date must be in YYYY-MM-DD format';
export const TIME_MESSAGE = 'Time must be in HH:MM format';
