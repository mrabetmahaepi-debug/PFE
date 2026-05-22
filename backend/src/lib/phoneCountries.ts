export interface PhoneCountryConfig {
  dialCode: string;
  maxDigits: number;
  validate: (digits: string) => boolean;
}

export const PHONE_COUNTRIES: PhoneCountryConfig[] = [
  { dialCode: "+216", maxDigits: 8, validate: (d) => /^[2459]\d{7}$/.test(d) },
  { dialCode: "+33", maxDigits: 9, validate: (d) => /^[67]\d{8}$/.test(d) },
  { dialCode: "+212", maxDigits: 9, validate: (d) => /^[5-7]\d{8}$/.test(d) },
  { dialCode: "+213", maxDigits: 9, validate: (d) => /^[567]\d{8}$/.test(d) },
  { dialCode: "+20", maxDigits: 10, validate: (d) => /^1\d{9}$/.test(d) },
  { dialCode: "+44", maxDigits: 10, validate: (d) => /^7\d{9}$/.test(d) },
  { dialCode: "+39", maxDigits: 10, validate: (d) => /^3\d{9}$/.test(d) },
  { dialCode: "+49", maxDigits: 11, validate: (d) => /^1[5-7]\d{8,9}$/.test(d) },
  { dialCode: "+1", maxDigits: 10, validate: (d) => /^\d{10}$/.test(d) },
];

const ALLOWED_DIAL_CODES = new Set(PHONE_COUNTRIES.map((c) => c.dialCode));

export function getCountryByDialCode(dialCode: string): PhoneCountryConfig | undefined {
  return PHONE_COUNTRIES.find((c) => c.dialCode === dialCode);
}

export function validatePhoneForCountry(
  dialCode: string,
  nationalDigits: string
): { valid: boolean; message?: string } {
  if (!ALLOWED_DIAL_CODES.has(dialCode)) {
    return { valid: false, message: "Indicatif pays non pris en charge." };
  }
  const country = getCountryByDialCode(dialCode)!;
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits.length) {
    return { valid: false, message: "Le numéro de téléphone est requis." };
  }
  if (digits.length !== country.maxDigits) {
    return {
      valid: false,
      message: `Le numéro doit contenir ${country.maxDigits} chiffres.`,
    };
  }
  if (!country.validate(digits)) {
    return { valid: false, message: "Numéro de téléphone invalide pour ce pays." };
  }
  return { valid: true };
}

export type ParsedPhoneFields = {
  phone: string | null;
  telephone: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
};

/** Split stored full number into display parts for API responses. */
export function parseStoredPhoneFields(
  stored: string | null | undefined
): ParsedPhoneFields {
  if (!stored?.trim()) {
    return {
      phone: null,
      telephone: null,
      phoneCountryCode: null,
      phoneNumber: null,
    };
  }

  const normalized = stored.trim().replace(/\s+/g, " ");
  const byDialLength = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  for (const country of byDialLength) {
    if (normalized.startsWith(country.dialCode)) {
      const nationalPart = normalized.slice(country.dialCode.length).trim();
      const digits = nationalPart.replace(/\D/g, "");
      return {
        phone: normalized,
        telephone: normalized,
        phoneCountryCode: country.dialCode,
        phoneNumber: digits,
      };
    }
  }

  return {
    phone: normalized,
    telephone: normalized,
    phoneCountryCode: null,
    phoneNumber: null,
  };
}

export function formatFullPhone(dialCode: string, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  const groups: string[] = [];
  if (dialCode === "+216" && digits.length === 8) {
    return `${dialCode} ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  if (digits.length >= 6) {
    groups.push(digits.slice(0, Math.min(3, digits.length - 3)));
    let i = groups[0].length;
    while (i < digits.length) {
      const chunk = digits.slice(i, i + 3);
      if (chunk) groups.push(chunk);
      i += 3;
    }
    return `${dialCode} ${groups.join(" ")}`;
  }
  return `${dialCode} ${digits}`;
}
