export interface PhoneNormalizationResult {
  isValid: boolean;
  normalizedPhone: string | null;
  reason: string | null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizePhoneNumber(rawPhoneNumber: string): PhoneNormalizationResult {
  const digits = digitsOnly(rawPhoneNumber ?? '');

  if (!digits) {
    return {
      isValid: false,
      normalizedPhone: null,
      reason: 'Telefon numarasi bos olamaz.',
    };
  }

  let normalized = digits;

  if (normalized.startsWith('00')) {
    normalized = normalized.slice(2);
  }

  if (normalized.length === 11 && normalized.startsWith('0')) {
    normalized = `90${normalized.slice(1)}`;
  } else if (normalized.length === 10) {
    normalized = `90${normalized}`;
  }

  if (!/^90\d{10}$/.test(normalized)) {
    return {
      isValid: false,
      normalizedPhone: null,
      reason: 'Telefon numarasini 10 haneli veya 90 ile baslayacak sekilde girin.',
    };
  }

  return {
    isValid: true,
    normalizedPhone: normalized,
    reason: null,
  };
}

export function arePhoneNumbersEquivalent(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }

  const leftNormalized = normalizePhoneNumber(left);
  const rightNormalized = normalizePhoneNumber(right);

  if (leftNormalized.isValid && rightNormalized.isValid) {
    return leftNormalized.normalizedPhone === rightNormalized.normalizedPhone;
  }

  return left.trim() === right.trim();
}

