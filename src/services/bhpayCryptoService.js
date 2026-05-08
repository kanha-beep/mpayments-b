import crypto from "crypto";

function normalizeKey(accessKey) {
  const raw = Buffer.from(`${accessKey || ""}`, "utf8");
  if (raw.length === 32) return raw;
  if (raw.length > 32) return raw.subarray(0, 32);
  return Buffer.concat([raw, Buffer.alloc(32 - raw.length)]);
}

export function encryptBhpayPayload(payload, accessKey) {
  const cipher = crypto.createCipheriv("aes-256-ecb", normalizeKey(accessKey), null);
  cipher.setAutoPadding(true);
  const plaintext = typeof payload === "string" ? payload : JSON.stringify(payload);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

export function decryptBhpayPayload(ciphertext, accessKey) {
  const decipher = crypto.createDecipheriv("aes-256-ecb", normalizeKey(accessKey), null);
  decipher.setAutoPadding(true);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
}
