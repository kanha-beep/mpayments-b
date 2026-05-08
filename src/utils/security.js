import crypto from "crypto";

const secret = process.env.AUTH_SECRET || "onlystack-dev-secret";

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, passwordHash) {
  return hashPassword(password) === passwordHash;
}

export function createSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function createApiToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySignedToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
