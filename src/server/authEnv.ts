import { AUTH_ENV } from "@/generated/authEnv";

const getFirstConfiguredValue = (...values: Array<string | undefined>) => {
  return values.find((value) => value && value.trim().length > 0)?.trim();
};

export const authEnv = AUTH_ENV;

export const getFirstAuthEnv = (...keys: Array<keyof typeof AUTH_ENV>) => {
  return getFirstConfiguredValue(...keys.map((key) => AUTH_ENV[key]));
};

export const parseAuthEmailList = (value: string | undefined) => {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};