import { db } from '@/db';
import { categories } from '@/db/schema';

export interface CategoryTemplate {
  baseId: string;
  name: string;
  type: 'income' | 'expense';
  group_50_30_20: 'income' | 'needs' | 'wants' | 'savings';
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORY_TEMPLATES: readonly CategoryTemplate[] = [
  { baseId: 'cat-maas', name: 'Maaş & Gelir', type: 'income', group_50_30_20: 'income', icon: '💰', color: '#10B981' },
  { baseId: 'cat-market', name: 'Market & Gıda', type: 'expense', group_50_30_20: 'needs', icon: '🛒', color: '#F59E0B' },
  { baseId: 'cat-kira', name: 'Kira & Konut', type: 'expense', group_50_30_20: 'needs', icon: '🏠', color: '#EF4444' },
  { baseId: 'cat-fatura', name: 'Faturalar & Abonelikler', type: 'expense', group_50_30_20: 'needs', icon: '⚡', color: '#3B82F6' },
  { baseId: 'cat-ulasim', name: 'Ulaşım & Yakıt', type: 'expense', group_50_30_20: 'needs', icon: '🚗', color: '#8B5CF6' },
  { baseId: 'cat-eeglence', name: 'Eğlence & Dışarıda Yeme', type: 'expense', group_50_30_20: 'wants', icon: '🍔', color: '#EC4899' },
  { baseId: 'cat-saglik', name: 'Sağlık & Kişisel Bakım', type: 'expense', group_50_30_20: 'needs', icon: '💊', color: '#06B6D4' },
  { baseId: 'cat-diger', name: 'Diğer Harcamalar', type: 'expense', group_50_30_20: 'wants', icon: '🏷️', color: '#6B7280' },
];

const TEMPLATE_BASE_IDS = DEFAULT_CATEGORY_TEMPLATES.map(t => t.baseId);

const TEMPLATE_ALIASES: Record<string, string> = {
  'cat-arac': 'cat-ulasim',
  'cat-sosyal': 'cat-eeglence',
};

/**
 * Şablon veya takma ad (cat-market, cat-arac vb.) verildiğinde canonical şablon ID'sini döndürür.
 */
export function normalizeCategoryTemplateBaseId(rawCategoryId?: string | null): string | null {
  if (!rawCategoryId || typeof rawCategoryId !== 'string') return null;
  const trimmed = rawCategoryId.trim();
  if (!trimmed) return null;
  if (TEMPLATE_ALIASES[trimmed]) return TEMPLATE_ALIASES[trimmed];
  if (TEMPLATE_BASE_IDS.includes(trimmed)) return trimmed;
  return null;
}

/**
 * Verilen aile kimliği için varsayılan kategori şablonunun izole satır ID'sini üretir.
 */
export function getFamilySeedCategoryId(baseIdOrAlias: string, familyId: string): string {
  const canonical = normalizeCategoryTemplateBaseId(baseIdOrAlias) || baseIdOrAlias;
  return `${canonical}-${familyId}`;
}

/**
 * Kategorinin silinemez sistem çekirdek şablonu (veya aile kopyası) olup olmadığını kontrol eder.
 */
export function isFamilySeedCategory(categoryId: string, familyId?: string | null): boolean {
  if (!categoryId) return false;
  if (TEMPLATE_BASE_IDS.includes(categoryId)) return true;
  if (familyId) {
    return TEMPLATE_BASE_IDS.some(baseId => categoryId === `${baseId}-${familyId}`);
  }
  return TEMPLATE_BASE_IDS.some(baseId => categoryId.startsWith(`${baseId}-`));
}

/**
 * Şablon veya ham kategori ID'sini ilgili ailenin kategori ID'sine çözer (özel kategorileri aynen korur).
 */
export function resolveCategoryIdForFamily(familyId: string, rawCategoryId: string): string {
  const baseId = normalizeCategoryTemplateBaseId(rawCategoryId);
  if (baseId) {
    return `${baseId}-${familyId}`;
  }
  return rawCategoryId;
}

/**
 * Bir aile için 8 varsayılan bütçe kategorisi satırını oluşturur.
 */
export function buildFamilySeedCategoryRows(familyId: string, nowISO = new Date().toISOString()) {
  return DEFAULT_CATEGORY_TEMPLATES.map(tpl => ({
    id: `${tpl.baseId}-${familyId}`,
    name: tpl.name,
    type: tpl.type,
    monthly_budget_limit: 0,
    group_50_30_20: tpl.group_50_30_20,
    icon: tpl.icon,
    color: tpl.color,
    is_family_shared: 1,
    family_id: familyId,
    created_at: nowISO,
    updated_at: nowISO,
    sync_status: 'synced',
    device_id: 'system-seed',
  }));
}

type InsertRunner = Pick<typeof db, 'insert'>;

/**
 * Ailenin çekirdek kategorileri veritabanında yoksa idempotent şekilde oluşturur ve döndürür.
 */
export async function ensureFamilyCategories(familyId: string, executor: InsertRunner = db) {
  const rows = buildFamilySeedCategoryRows(familyId);
  const query = executor.insert(categories).values(rows) as {
    onConflictDoNothing?: () => Promise<unknown>;
  } & Promise<unknown>;
  if (typeof query.onConflictDoNothing === 'function') {
    await query.onConflictDoNothing();
  } else {
    await query;
  }
  return rows;
}
