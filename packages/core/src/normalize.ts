import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";

type Raw = string | null | undefined;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Consumer mailbox providers: a shared domain here says nothing about a shared company. */
export const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "web.de",
  "yandex.com",
  "mail.ru",
  "qq.com",
  "163.com",
  "zoho.com",
]);

const COMPANY_NOISE_WORDS: ReadonlySet<string> = new Set([
  "the",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "gmbh",
  "plc",
  "sa",
  "sas",
  "bv",
  "ag",
  "pty",
]);

const MIN_PHONE_DIGITS = 7;

export function normalizeEmail(raw: Raw): string | null {
  const email = raw?.trim().toLowerCase() ?? "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** "https://www.Acme.com/about" -> "acme.com". Returns null when there is no plausible domain. */
export function normalizeDomain(raw: Raw): string | null {
  const host = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#:]/)[0];
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

export function corporateDomain(domain: string | null): string | null {
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

/** Returns E.164 ("+14155552671") or null. */
export function normalizePhone(raw: Raw, defaultCountry?: string): string | null {
  const text = raw?.trim() ?? "";
  if (text.replace(/\D/g, "").length < MIN_PHONE_DIGITS) return null;
  const parsed = parsePhoneNumberFromString(text, defaultCountry as CountryCode | undefined);
  return parsed?.isPossible() ? parsed.number : null;
}

function foldText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCompanyName(raw: Raw): string | null {
  const words = foldText(raw ?? "")
    .split(" ")
    .filter((w) => w !== "" && !COMPANY_NOISE_WORDS.has(w));
  return words.length > 0 ? words.join(" ") : null;
}

export function normalizePersonName(raw: Raw): string | null {
  const name = foldText(raw ?? "");
  return name === "" ? null : name;
}
