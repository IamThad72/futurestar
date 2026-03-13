import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

// OWASP 2025: PBKDF2-SHA512 should use 310,000+ iterations for secure password storage
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = "sha512";
const PASSWORD_SALT_BYTES = 32;

export const hashPassword = (password: string) => {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEYLEN,
    PASSWORD_DIGEST,
  ).toString("hex");

  return `${PASSWORD_ITERATIONS}:${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [iterationsRaw, salt, storedHash] = stored.split(":");

  if (!iterationsRaw || !salt || !storedHash) {
    return false;
  }

  const iterations = Number(iterationsRaw);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const hash = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_KEYLEN,
    PASSWORD_DIGEST,
  ).toString("hex");

  return timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(hash, "hex"));
};
