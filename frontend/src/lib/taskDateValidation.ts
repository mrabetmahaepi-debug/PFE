import {
  parseDdMmYyyyToIso,
  parseIsoDateLocal,
} from '../components/ActivityThemedCalendar';

/** Returns an error message when end is strictly before start (yyyy-mm-dd). */
export function validateTaskDateRange(
  startDate: string,
  endDate: string
): string | null {
  if (!startDate?.trim() || !endDate?.trim()) return null;
  if (endDate < startDate) {
    return 'La date de fin ne peut pas être antérieure à la date de début.';
  }
  return null;
}

export function isValidIsoDateKey(iso: string): boolean {
  return parseIsoDateLocal(iso.trim()) != null;
}

/** Validate jj/mm/aaaa text on blur (empty allowed). */
export function validateFrenchDateText(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (!digits.length) return null;
  if (digits.length < 8) {
    return 'Date incomplète. Format attendu : jj/mm/aaaa';
  }
  if (!parseDdMmYyyyToIso(text)) {
    return 'Date invalide.';
  }
  return null;
}

export function isoFromDateInput(value: string): string | undefined {
  if (!value?.trim()) return undefined;
  const local = parseIsoDateLocal(value.trim());
  if (!local) return undefined;
  return local.toISOString();
}