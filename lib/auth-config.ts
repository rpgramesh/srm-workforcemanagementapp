import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";

export interface AdminCredentials {
  normalizedMobile: string;
  pin: string;
}

export interface UserCredentials {
  normalizedMobile: string;
  pin: string;
}

function getAdminCredentials(): AdminCredentials | null {
  const rawMobile = process.env.ADMIN_MOBILE;
  const pin = process.env.ADMIN_PIN;

  if (!rawMobile || !pin) {
    return null;
  }

  const normalizedMobile = normalizeAustralianMobile(rawMobile);

  if (!normalizedMobile) {
    return null;
  }

  return { normalizedMobile, pin };
}

function getUserCredentials(): UserCredentials | null {
  const rawMobile = process.env.USER_MOBILE;
  const pin = process.env.USER_PIN;

  if (!rawMobile || !pin) {
    return null;
  }

  const normalizedMobile = normalizeAustralianMobile(rawMobile);

  if (!normalizedMobile) {
    return null;
  }

  return { normalizedMobile, pin };
}

export const adminCredentials = getAdminCredentials();
export const userCredentials = getUserCredentials();

export function isAdminConfigured(): boolean {
  return adminCredentials !== null;
}

export function isUserConfigured(): boolean {
  return userCredentials !== null;
}
