const STRIP_FORMATTING_PATTERN = /[\s\-()]/g;

export function normalizeAustralianMobile(input: string): string | null {
  const cleaned = input.replace(STRIP_FORMATTING_PATTERN, "").trim();

  if (/^\+614\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^614\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^04\d{8}$/.test(cleaned)) {
    return `+61${cleaned.slice(1)}`;
  }

  return null;
}

export function isAustralianMobile(input: string): boolean {
  return normalizeAustralianMobile(input) !== null;
}

export function formatAustralianMobile(input: string): string {
  const raw = input.replace(/[^\d+]/g, "");
  const normalized = normalizeAustralianMobile(raw);

  if (normalized) {
    return normalized.replace(/^(\+61)(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
  }

  if (raw.startsWith("+61")) {
    const digits = raw.slice(3).replace(/\D/g, "").slice(0, 9);
    return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (raw.startsWith("61")) {
    const digits = raw.slice(2).replace(/\D/g, "").slice(0, 9);
    return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (raw.startsWith("0")) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`
      .replace(/\s+/g, " ")
      .trim();
  }

  return raw;
}
