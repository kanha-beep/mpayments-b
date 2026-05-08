export const DEFAULT_MERCHANT_ID = "m_only_stack";
export const DEFAULT_MERCHANT_EMAIL = "monish@mpayprocessing.com";
export const DEFAULT_MERCHANT_PASSWORD = "password";
export const DEFAULT_MERCHANT_TOKEN = "USER_TOKEN_XYZ789";

export const MERCHANT_ID = process.env.SEED_MERCHANT_ID || DEFAULT_MERCHANT_ID;
export const MERCHANT_EMAIL = process.env.SEED_MERCHANT_EMAIL || DEFAULT_MERCHANT_EMAIL;
export const MERCHANT_PASSWORD = process.env.SEED_MERCHANT_PASSWORD || DEFAULT_MERCHANT_PASSWORD;
export const MERCHANT_TOKEN = process.env.SEED_MERCHANT_TOKEN || DEFAULT_MERCHANT_TOKEN;

export function isDemoMerchantSetup() {
  return (
    MERCHANT_ID === DEFAULT_MERCHANT_ID &&
    MERCHANT_EMAIL === DEFAULT_MERCHANT_EMAIL &&
    MERCHANT_PASSWORD === DEFAULT_MERCHANT_PASSWORD &&
    MERCHANT_TOKEN === DEFAULT_MERCHANT_TOKEN
  );
}

export function formatCurrency(amount) {
  return `INR ${Number(amount ?? 0).toFixed(2)}`;
}

export function formatDateTime(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}
