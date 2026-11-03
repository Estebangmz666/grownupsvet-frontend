import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

const countryNames = new Intl.DisplayNames(["es"], { type: "region" });

export const registrationPhoneCountries = getCountries()
  .map((country) => ({
    value: country,
    label: `${countryNames.of(country) ?? country} (+${getCountryCallingCode(country)})`,
  }))
  .sort((left, right) => left.label.localeCompare(right.label, "es"));

/** Only presentation changes: the API continues to receive an ISO calendar date. */
export function registrationDateToIso(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** Parse using worldwide metadata; never concatenate an already international number. */
export function registrationInternationalPhone(
  country: CountryCode,
  nationalNumber: string,
): string {
  const value = nationalNumber.trim();
  if (!/^[+\d\s().-]+$/.test(value)) return "";
  const phone = parsePhoneNumberFromString(value, {
    defaultCountry: country,
    extract: false,
  });
  if (
    !phone?.isValid() ||
    phone.ext ||
    phone.countryCallingCode !== getCountryCallingCode(country)
  )
    return "";
  return phone.number;
}
