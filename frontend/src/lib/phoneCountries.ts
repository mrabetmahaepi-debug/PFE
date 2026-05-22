export interface PhoneCountryConfig {
  iso: string;
  name: string;
  flag: string;
  dialCode: string;
  placeholder: string;
  maxDigits: number;
  /** Validate national number (digits only, no country code). */
  validate: (digits: string) => boolean;
  format: (digits: string) => string;
}

export const DEFAULT_PHONE_COUNTRY_ISO = 'TN';

export const PHONE_COUNTRIES: PhoneCountryConfig[] = [
  {
    iso: 'TN',
    name: 'Tunisie',
    flag: '🇹🇳',
    dialCode: '+216',
    placeholder: '20 000 000',
    maxDigits: 8,
    validate: (d) => /^[2459]\d{7}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 8);
      if (x.length <= 2) return x;
      if (x.length <= 5) return `${x.slice(0, 2)} ${x.slice(2)}`;
      return `${x.slice(0, 2)} ${x.slice(2, 5)} ${x.slice(5)}`;
    },
  },
  {
    iso: 'FR',
    name: 'France',
    flag: '🇫🇷',
    dialCode: '+33',
    placeholder: '6 12 34 56 78',
    maxDigits: 9,
    validate: (d) => /^[67]\d{8}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 9);
      if (x.length <= 1) return x;
      if (x.length <= 3) return `${x.slice(0, 1)} ${x.slice(1)}`;
      if (x.length <= 5) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3)}`;
      if (x.length <= 7) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5)}`;
      return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5, 7)} ${x.slice(7)}`;
    },
  },
  {
    iso: 'MA',
    name: 'Maroc',
    flag: '🇲🇦',
    dialCode: '+212',
    placeholder: '6 12 34 56 78',
    maxDigits: 9,
    validate: (d) => /^[5-7]\d{8}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 9);
      if (x.length <= 1) return x;
      if (x.length <= 3) return `${x.slice(0, 1)} ${x.slice(1)}`;
      if (x.length <= 5) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3)}`;
      if (x.length <= 7) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5)}`;
      return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5, 7)} ${x.slice(7)}`;
    },
  },
  {
    iso: 'DZ',
    name: 'Algérie',
    flag: '🇩🇿',
    dialCode: '+213',
    placeholder: '5 55 12 34 56',
    maxDigits: 9,
    validate: (d) => /^[567]\d{8}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 9);
      if (x.length <= 1) return x;
      if (x.length <= 3) return `${x.slice(0, 1)} ${x.slice(1)}`;
      if (x.length <= 5) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3)}`;
      if (x.length <= 7) return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5)}`;
      return `${x.slice(0, 1)} ${x.slice(1, 3)} ${x.slice(3, 5)} ${x.slice(5, 7)} ${x.slice(7)}`;
    },
  },
  {
    iso: 'EG',
    name: 'Égypte',
    flag: '🇪🇬',
    dialCode: '+20',
    placeholder: '10 1234 5678',
    maxDigits: 10,
    validate: (d) => /^1\d{9}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 10);
      if (x.length <= 2) return x;
      if (x.length <= 6) return `${x.slice(0, 2)} ${x.slice(2)}`;
      return `${x.slice(0, 2)} ${x.slice(2, 6)} ${x.slice(6)}`;
    },
  },
  {
    iso: 'GB',
    name: 'Royaume-Uni',
    flag: '🇬🇧',
    dialCode: '+44',
    placeholder: '7123 456789',
    maxDigits: 10,
    validate: (d) => /^7\d{9}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 10);
      if (x.length <= 4) return x;
      return `${x.slice(0, 4)} ${x.slice(4)}`;
    },
  },
  {
    iso: 'IT',
    name: 'Italie',
    flag: '🇮🇹',
    dialCode: '+39',
    placeholder: '312 345 6789',
    maxDigits: 10,
    validate: (d) => /^3\d{9}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 10);
      if (x.length <= 3) return x;
      if (x.length <= 6) return `${x.slice(0, 3)} ${x.slice(3)}`;
      return `${x.slice(0, 3)} ${x.slice(3, 6)} ${x.slice(6)}`;
    },
  },
  {
    iso: 'DE',
    name: 'Allemagne',
    flag: '🇩🇪',
    dialCode: '+49',
    placeholder: '151 23456789',
    maxDigits: 11,
    validate: (d) => /^1[5-7]\d{8,9}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 11);
      if (x.length <= 3) return x;
      return `${x.slice(0, 3)} ${x.slice(3)}`;
    },
  },
  {
    iso: 'US',
    name: 'États-Unis',
    flag: '🇺🇸',
    dialCode: '+1',
    placeholder: '202 555 0123',
    maxDigits: 10,
    validate: (d) => /^\d{10}$/.test(d),
    format: (d) => {
      const x = d.slice(0, 10);
      if (x.length <= 3) return x;
      if (x.length <= 6) return `${x.slice(0, 3)} ${x.slice(3)}`;
      return `${x.slice(0, 3)} ${x.slice(3, 6)} ${x.slice(6)}`;
    },
  },
];

/** Tunisia first, then alphabetical by country name. */
export const PHONE_COUNTRIES_SORTED: PhoneCountryConfig[] = [
  ...PHONE_COUNTRIES.filter((c) => c.iso === DEFAULT_PHONE_COUNTRY_ISO),
  ...PHONE_COUNTRIES.filter((c) => c.iso !== DEFAULT_PHONE_COUNTRY_ISO).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  ),
];

export function getCountryByIso(iso: string): PhoneCountryConfig {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0];
}

export function filterCountries(query: string): PhoneCountryConfig[] {
  const q = query.trim().toLowerCase();
  if (!q) return PHONE_COUNTRIES_SORTED;
  return PHONE_COUNTRIES_SORTED.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.iso.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.dialCode.replace('+', '').includes(q)
  );
}

export function getCountryByDialCode(dialCode: string): PhoneCountryConfig {
  return PHONE_COUNTRIES.find((c) => c.dialCode === dialCode) ?? PHONE_COUNTRIES[0];
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatFullPhone(dialCode: string, nationalDigits: string): string {
  const country = getCountryByDialCode(dialCode);
  const digits = digitsOnly(nationalDigits).slice(0, country.maxDigits);
  const formatted = country.format(digits);
  return formatted ? `${dialCode} ${formatted}` : dialCode;
}

export type PhoneFields = {
  phone?: string | null;
  telephone?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
};

/** Format phone for display from parts or stored full number. */
export function formatDisplayPhone(source?: PhoneFields | null): string | null {
  if (!source) return null;

  const code = source.phoneCountryCode?.trim();
  const national = digitsOnly(source.phoneNumber ?? '');
  if (code && national) {
    return formatFullPhone(code, national);
  }

  const stored = source.phone?.trim() || source.telephone?.trim();
  return stored || null;
}

export type EnterprisePhoneSource = PhoneFields & {
  admin?: PhoneFields | null;
  responsibleAdmin?: PhoneFields | null;
};

/** Resolve admin phone for SuperAdmin enterprise detail (user-specified fallbacks). */
export function resolveEnterpriseAdminPhoneDisplay(
  enterprise?: EnterprisePhoneSource | null
): string {
  if (!enterprise) return 'Non renseigné';

  const phoneCountryCode =
    enterprise.responsibleAdmin?.phoneCountryCode?.trim() ||
    enterprise.admin?.phoneCountryCode?.trim() ||
    enterprise.phoneCountryCode?.trim() ||
    '';

  const adminPhone =
    enterprise.responsibleAdmin?.phone?.trim() ||
    enterprise.responsibleAdmin?.telephone?.trim() ||
    enterprise.admin?.phone?.trim() ||
    enterprise.admin?.telephone?.trim() ||
    enterprise.phone?.trim() ||
    enterprise.telephone?.trim() ||
    null;

  const nationalDigits =
    enterprise.responsibleAdmin?.phoneNumber ||
    enterprise.admin?.phoneNumber ||
    enterprise.phoneNumber ||
    '';

  if (phoneCountryCode && nationalDigits) {
    const formatted = formatDisplayPhone({
      phoneCountryCode,
      phoneNumber: nationalDigits,
    });
    if (formatted) return formatted;
  }

  if (phoneCountryCode && adminPhone && !adminPhone.startsWith('+')) {
    return formatDisplayPhone({ phoneCountryCode, phoneNumber: adminPhone });
  }

  if (adminPhone) return adminPhone;

  return 'Non renseigné';
}

/** @deprecated Use resolveEnterpriseAdminPhoneDisplay */
export function resolveAdminPhoneDisplay(
  admin?: PhoneFields | null,
  enterpriseTelephone?: string | null
): string {
  return resolveEnterpriseAdminPhoneDisplay({
    admin,
    responsibleAdmin: admin,
    telephone: enterpriseTelephone,
    phone: enterpriseTelephone,
  });
}

/** Parse stored full number (e.g. "+216 54 313 201") into country + national digits. */
export function parseStoredPhone(stored: string | null | undefined): {
  countryIso: string;
  phoneCountryCode: string;
  phoneNumber: string;
  display: string;
} {
  const fallbackCountry = getCountryByIso(DEFAULT_PHONE_COUNTRY_ISO);
  const empty = () => ({
    countryIso: fallbackCountry.iso,
    phoneCountryCode: fallbackCountry.dialCode,
    phoneNumber: '',
    display: '',
  });

  if (!stored?.trim()) return empty();

  const normalized = stored.trim().replace(/\s+/g, ' ');
  const byDialLength = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  for (const country of byDialLength) {
    if (normalized.startsWith(country.dialCode)) {
      const nationalPart = normalized.slice(country.dialCode.length).trim();
      const digits = digitsOnly(nationalPart).slice(0, country.maxDigits);
      return {
        countryIso: country.iso,
        phoneCountryCode: country.dialCode,
        phoneNumber: digits,
        display: country.format(digits),
      };
    }
  }

  const digits = digitsOnly(normalized).slice(0, fallbackCountry.maxDigits);
  return {
    countryIso: fallbackCountry.iso,
    phoneCountryCode: fallbackCountry.dialCode,
    phoneNumber: digits,
    display: fallbackCountry.format(digits),
  };
}

export function validatePhoneForCountry(
  dialCode: string,
  nationalDigits: string
): { valid: boolean; message?: string } {
  const country = getCountryByDialCode(dialCode);
  const digits = digitsOnly(nationalDigits);
  if (!digits.length) {
    return { valid: false, message: 'Le numéro de téléphone est requis.' };
  }
  if (digits.length !== country.maxDigits) {
    return {
      valid: false,
      message: `Le numéro doit contenir ${country.maxDigits} chiffres (ex. ${country.placeholder}).`,
    };
  }
  if (!country.validate(digits)) {
    return {
      valid: false,
      message: `Numéro invalide pour ${country.name}. Ex. ${country.placeholder}`,
    };
  }
  return { valid: true };
}
