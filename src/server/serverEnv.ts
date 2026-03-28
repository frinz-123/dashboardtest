import { SERVER_ENV } from "@/generated/serverEnv";

const getFirstConfiguredValue = (...values: Array<string | undefined>) => {
  return values.find((value) => value && value.trim().length > 0)?.trim();
};

export const serverEnv = SERVER_ENV;

export const getFirstServerEnv = (...keys: Array<keyof typeof SERVER_ENV>) => {
  return getFirstConfiguredValue(...keys.map((key) => SERVER_ENV[key]));
};

export const parseServerEmailList = (value: string | undefined) => {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const getMissingServerEnv = (...keys: Array<keyof typeof SERVER_ENV>) => {
  return keys.filter((key) => !SERVER_ENV[key]?.trim());
};
