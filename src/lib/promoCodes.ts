export type PromoDiscountType = 'percentage' | 'fixed';
export type PromoApplyScope = 'all' | 'specific';

export interface PromoCode {
  id: string;
  code: string;
  type: PromoDiscountType;
  value: number;
  active: boolean;
  applyScope: PromoApplyScope;
  itemIds: string[];
  createdAt: string;
}

export const PROMO_CODES_STORAGE_KEY = 'tawla-promo-codes';

function parsePromoCode(value: unknown): PromoCode | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<PromoCode> & {
    applyScope?: PromoApplyScope;
    itemIds?: unknown;
  };

  const normalizedCode = normalizePromoCode(String(candidate.code ?? ''));
  const parsedValue = Number(candidate.value);

  if (
    !(typeof candidate.id === 'string' && candidate.id.trim().length > 0) ||
    normalizedCode.length === 0 ||
    !(candidate.type === 'percentage' || candidate.type === 'fixed') ||
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    typeof candidate.active !== 'boolean' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  const applyScope: PromoApplyScope = candidate.applyScope === 'specific' ? 'specific' : 'all';
  const rawItemIds = Array.isArray(candidate.itemIds) ? candidate.itemIds : [];
  const itemIds = rawItemIds
    .map((itemId) => String(itemId ?? '').trim())
    .filter(Boolean);

  return {
    id: candidate.id.trim(),
    code: normalizedCode,
    type: candidate.type,
    value: Number(parsedValue.toFixed(2)),
    active: candidate.active,
    applyScope,
    itemIds: applyScope === 'specific' ? Array.from(new Set(itemIds)) : [],
    createdAt: candidate.createdAt,
  };
}

export function normalizePromoCode(input: string) {
  return String(input ?? '').trim().toUpperCase();
}

export function readPromoCodesFromStorage(): PromoCode[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PROMO_CODES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((promo) => parsePromoCode(promo))
      .filter((promo): promo is PromoCode => Boolean(promo));
  } catch {
    return [];
  }
}

export function writePromoCodesToStorage(codes: PromoCode[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitized = codes
    .map((promo) => parsePromoCode(promo))
    .filter((promo): promo is PromoCode => Boolean(promo));

  window.localStorage.setItem(PROMO_CODES_STORAGE_KEY, JSON.stringify(sanitized));
}

export function getActivePromoCodeByInput(input: string, source?: PromoCode[]) {
  const normalized = normalizePromoCode(input);
  if (!normalized) return null;

  const codes = source ?? readPromoCodesFromStorage();
  return codes.find((promo) => promo.active && promo.code === normalized) ?? null;
}

export function calculatePromoDiscount(subtotal: number, promo: PromoCode) {
  const safeSubtotal = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  if (safeSubtotal <= 0) return 0;

  if (promo.type === 'percentage') {
    const rate = Math.min(Math.max(Number(promo.value), 0), 100);
    return Number(((safeSubtotal * rate) / 100).toFixed(2));
  }

  return Number(Math.min(safeSubtotal, Math.max(0, Number(promo.value))).toFixed(2));
}
