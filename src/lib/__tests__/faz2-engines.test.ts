import { describe, it, expect } from 'vitest';
import {
  computeHabitStats,
  computeHabitSummaryAndBadges,
  HabitItem,
  HabitLogItem
} from '../habits-engine';
import {
  NOTE_TEMPLATES,
  estimateReadingMinutes,
  extractNoteSnippet,
  parseSafeMarkdownBlocks
} from '../notes-utils';
import { parseTurkishBankCsv } from '../bank-csv-parser';
import { calculateHeatmapMatrix } from '../calendar-heatmap';

describe('Faz 2 — Habit OS, Notes OS, Banka CSV & Isı Haritası 5. Kriter Testleri', () => {
  it('Esnek haftalık kota dolunca kalan günlerde ceza vermez ve 0-100 skoru + rozetleri hesaplar', () => {
    const habit: HabitItem = {
      id: 'h-1',
      user_id: 'u-1',
      title: 'Haftada 3 Gün Spor',
      category: 'Sağlık & Beden',
      color: '#10B981',
      icon: 'fitness',
      target_type: 'boolean',
      target_value: 1,
      unit_label: 'kez',
      frequency_type: 'flexible_weekly',
      weekly_target_count: 3,
      time_of_day: 'evening',
      is_archived: 0,
      sort_order: 0,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z'
    };

    // 2026-11-19 Perşembe; hafta başı 2026-11-16 Pazartesi
    const logs: HabitLogItem[] = [
      { id: 'l1', habit_id: 'h-1', user_id: 'u-1', date: '2026-11-16', value: 1, is_completed: 1 },
      { id: 'l2', habit_id: 'h-1', user_id: 'u-1', date: '2026-11-17', value: 1, is_completed: 1 },
      { id: 'l3', habit_id: 'h-1', user_id: 'u-1', date: '2026-11-18', value: 1, is_completed: 1 }
    ];

    const stats = computeHabitStats(habit, logs, '2026-11-19');
    expect(stats.weeklyCompletedCount).toBe(3);
    expect(stats.weeklyQuotaSatisfied).toBe(true);
    expect(stats.currentStreak).toBe(3);

    const summary = computeHabitSummaryAndBadges([habit], { 'h-1': stats });
    expect(summary.healthScore).toBeGreaterThan(0);
    expect(summary.badges.find(b => b.id === 'perfect_week')?.unlocked).toBe(true);
    expect(summary.badges.find(b => b.id === 'spark_3')?.unlocked).toBe(true);
  });

  it('Notes OS şablonları, okuma süresi ve XSS güvenli Markdown bloklarını ayrıştırır', () => {
    expect(NOTE_TEMPLATES.length).toBe(4);
    expect(estimateReadingMinutes('bir '.repeat(400))).toBe(2);
    expect(extractNoteSnippet('# Başlık\n> Alıntı metni burada', 50)).toContain('Başlık');

    const blocks = parseSafeMarkdownBlocks('# Ana Başlık\n> Bir alıntı\n- [x] Tamamlandı\n- Madde');
    expect(blocks.map(b => b.type)).toEqual(['h1', 'quote', 'checklist', 'bullet']);
    expect((blocks[2] as any).checked).toBe(true);
  });

  it('TR Banka CSV ayrıştırıcısı ; ayracını, Türkçe tutarı ve mükerrer kayıtları tespit eder', () => {
    const csv = [
      'Tarih;Açıklama;Tutar',
      '18.11.2026;MİGROS MARKET;-1.450,50',
      '19.11.2026;MAAŞ ÖDEMESİ;65.000,00'
    ].join('\n');

    const parsed = parseTurkishBankCsv(csv, [
      { transaction_date: '2026-11-18', amount: 1450.5, merchant: 'Migros Market' }
    ]);

    expect(parsed.length).toBe(2);
    expect(parsed[0].date).toBe('2026-11-18');
    expect(parsed[0].amount).toBe(1450.5);
    expect(parsed[0].txType).toBe('expense');
    expect(parsed[0].isDuplicate).toBe(true);
    expect(parsed[0].selected).toBe(false);

    expect(parsed[1].txType).toBe('income');
    expect(parsed[1].amount).toBe(65000);
    expect(parsed[1].isDuplicate).toBe(false);
  });

  it('Yaşam Takvimi Isı Haritası özel alışkanlık tamamlamayı 5. kriter olarak dahil eder', () => {
    const refDate = new Date('2026-11-19T12:00:00Z');
    const summary = calculateHeatmapMatrix(
      {
        fastingSessions: [],
        readingSessions: [],
        transactions: [{ amount: 500, transaction_date: '2026-11-19', merchant: 'Market' }],
        waterLogs: [],
        habitLogs: [
          { date: '2026-11-19', is_completed: 1 },
          { date: '2026-11-19', is_completed: 1 }
        ],
        activeHabitsCount: 2
      },
      30,
      refDate
    );

    const todayCell = summary.days[summary.days.length - 1];
    expect(todayCell.completedHabitsCount).toBe(2);
    expect(todayCell.habitsMetCount).toBeGreaterThanOrEqual(1);
    expect(todayCell.dominantLevel).toBeGreaterThanOrEqual(1);
  });
});
