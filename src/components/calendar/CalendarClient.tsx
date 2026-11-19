'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Edit3,
  Users,
  BookOpen,
  CheckSquare,
  Repeat,
  X,
} from 'lucide-react';
import {
  formatTurkishDisplayDate,
  getShortTurkishDayName,
  getTodayTurkeyDate,
  shiftTurkeyDate,
} from '@/lib/date-utils';
import {
  TIME_BLOCK_CATEGORIES,
  TimeBlockItem,
  computeTimeBlocksSummary,
  detectTimeBlockConflicts,
  findNextAvailableSlot,
  formatMinutesToDuration,
  getTimeBlockCategoryMeta,
  getTurkeyWeekDates,
  parseTimeToMinutes,
} from '@/lib/time-blocks-engine';
import PageLoadingState from '@/components/ui/PageLoadingState';

interface UnscheduledTask {
  id: string;
  title: string;
  priority: string;
  due_date?: string | null;
  estimated_minutes?: number | null;
}

interface ActiveBook {
  id: string;
  title: string;
  author?: string | null;
  current_page: number;
  total_pages: number;
}

interface ActiveHabit {
  id: string;
  title: string;
  icon: string;
  color: string;
}

const HABIT_EMOJI_MAP: Record<string, string> = {
  check: '✅',
  water: '💧',
  book: '📚',
  meditation: '🧘',
  fitness: '🏋️',
  walk: '🚶',
  code: '💻',
  sleep: '😴',
  heart: '❤️',
  bolt: '⚡',
};

function resolveHabitEmoji(iconKey: string): string {
  if (!iconKey) return '🔁';
  return HABIT_EMOJI_MAP[iconKey] || iconKey;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: '🔴 Kritik',
  high: '🟡 Yüksek',
  medium: '🔵 Orta',
  low: '⚪ Düşük',
};

export default function CalendarClient() {
  const [today, setToday] = useState<string>(() => getTodayTurkeyDate());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayTurkeyDate());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');
  const [blocks, setBlocks] = useState<TimeBlockItem[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<UnscheduledTask[]>([]);
  const [activeBooks, setActiveBooks] = useState<ActiveBook[]>([]);
  const [activeHabits, setActiveHabits] = useState<ActiveHabit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoaded, setInitialLoaded] = useState<boolean>(false);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'tasks' | 'books' | 'habits'>('tasks');
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlockItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(today);
  const [formStart, setFormStart] = useState<string>('09:00');
  const [formEnd, setFormEnd] = useState<string>('10:00');
  const [formCategory, setFormCategory] = useState<string>('deep_work');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formShared, setFormShared] = useState<boolean>(false);
  const [formLinkedTaskId, setFormLinkedTaskId] = useState<string>('');
  const [formLinkedBookId, setFormLinkedBookId] = useState<string>('');
  const [formLinkedHabitId, setFormLinkedHabitId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [pendingFollowUp, setPendingFollowUp] = useState<{
    blockId: string;
    blockTitle: string;
    blockDate: string;
    taskId: string | null;
    habitId: string | null;
  } | null>(null);
  const [followUpBusy, setFollowUpBusy] = useState<boolean>(false);

  const notify = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Midnight Europe/Istanbul rollover check
  useEffect(() => {
    const syncToday = () => {
      const nextToday = getTodayTurkeyDate();
      setToday((prev) => {
        if (prev !== nextToday) {
          setSelectedDate((sel) => (sel === prev ? nextToday : sel));
          return nextToday;
        }
        return prev;
      });
    };
    const timer = setInterval(syncToday, 60_000);
    window.addEventListener('focus', syncToday);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncToday);
    };
  }, []);

  const weekDates = useMemo(() => getTurkeyWeekDates(selectedDate), [selectedDate]);
  const rangeFrom = viewMode === 'weekly' ? weekDates[0] : selectedDate;
  const rangeTo = viewMode === 'weekly' ? weekDates[6] : selectedDate;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/time-blocks?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setBlocks(json.data.blocks ?? []);
        setUnscheduledTasks(json.data.unscheduledTasks ?? []);
        setActiveBooks(json.data.activeBooks ?? []);
        setActiveHabits(json.data.activeHabits ?? []);
      } else {
        notify(json.error || 'Veriler alınamadı.', 'err');
      }
    } catch {
      notify('Bağlantı hatası oluştu.', 'err');
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [rangeFrom, rangeTo, notify]);

  useEffect(() => {
    void fetchData();
    const onRefresh = () => void fetchData();
    window.addEventListener('singularity-refresh', onRefresh);
    return () => window.removeEventListener('singularity-refresh', onRefresh);
  }, [fetchData]);

  // Default to daily on mobile viewports on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('daily');
    }
  }, []);

  const conflictIds = useMemo(() => detectTimeBlockConflicts(blocks), [blocks]);
  const summary = useMemo(() => computeTimeBlocksSummary(blocks), [blocks]);

  const dailyBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)),
    [blocks, selectedDate]
  );

  const nextTaskSlot = useMemo(
    () => findNextAvailableSlot(dailyBlocks, '10:00', 60),
    [dailyBlocks]
  );
  const nextBookSlot = useMemo(
    () => findNextAvailableSlot(dailyBlocks, '21:00', 45),
    [dailyBlocks]
  );
  const nextHabitSlot = useMemo(
    () => findNextAvailableSlot(dailyBlocks, '08:00', 30),
    [dailyBlocks]
  );

  const openCreateModal = (presetDate?: string) => {
    setEditingBlock(null);
    setFormTitle('');
    setFormDate(presetDate || selectedDate);
    setFormStart('09:00');
    setFormEnd('10:00');
    setFormCategory('deep_work');
    setFormNotes('');
    setFormShared(false);
    setFormLinkedTaskId('');
    setFormLinkedBookId('');
    setFormLinkedHabitId('');
    setModalOpen(true);
  };

  const openEditModal = (block: TimeBlockItem) => {
    setEditingBlock(block);
    setFormTitle(block.title);
    setFormDate(block.date);
    setFormStart(block.start_time);
    setFormEnd(block.end_time);
    setFormCategory(block.category);
    setFormNotes(block.notes || '');
    setFormShared(block.is_family_shared === 1);
    setFormLinkedTaskId(block.linked_task_id || '');
    setFormLinkedBookId(block.linked_book_id || '');
    setFormLinkedHabitId(block.linked_habit_id || '');
    setModalOpen(true);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      notify('Başlık girmelisiniz.', 'err');
      return;
    }
    const startM = parseTimeToMinutes(formStart);
    const endM = parseTimeToMinutes(formEnd);
    if (startM < 0 || endM <= startM) {
      notify('Bitiş saati başlangıçtan sonra olmalıdır.', 'err');
      return;
    }
    setSaving(true);
    try {
      const catMeta = getTimeBlockCategoryMeta(formCategory);
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingBlock ? 'update' : 'create',
          id: editingBlock?.id,
          title: formTitle.trim(),
          date: formDate,
          start_time: formStart,
          end_time: formEnd,
          category: catMeta.id,
          color: catMeta.color,
          notes: formNotes.trim() || null,
          is_family_shared: formShared,
          linked_task_id: formLinkedTaskId || null,
          linked_book_id: formLinkedBookId || null,
          linked_habit_id: formLinkedHabitId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(editingBlock ? 'Zaman bloğu güncellendi.' : 'Zaman bloğu eklendi.');
        setModalOpen(false);
        void fetchData();
      } else {
        notify(json.error || 'İşlem başarısız.', 'err');
      }
    } catch {
      notify('Kayıt sırasında hata oluştu.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (block: TimeBlockItem) => {
    const nextCompleted = block.is_completed === 1 ? 0 : 1;
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_complete', id: block.id }),
      });
      const json = await res.json();
      if (json.success) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === block.id ? { ...b, is_completed: nextCompleted } : b
          )
        );
        if (nextCompleted === 1 && (block.linked_task_id || block.linked_habit_id)) {
          setPendingFollowUp({
            blockId: block.id,
            blockTitle: block.title,
            blockDate: block.date,
            taskId: block.linked_task_id || null,
            habitId: block.linked_habit_id || null,
          });
        } else if (nextCompleted === 0 && pendingFollowUp?.blockId === block.id) {
          setPendingFollowUp(null);
        }
      } else {
        notify(json.error || 'Güncellenemedi.', 'err');
      }
    } catch {
      notify('Bağlantı hatası.', 'err');
    }
  };

  const handleConfirmLinkedTask = async () => {
    if (!pendingFollowUp?.taskId || followUpBusy) return;
    setFollowUpBusy(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_complete',
          task_id: pendingFollowUp.taskId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify('✅ Bağlı görev tamamlandı olarak işaretlendi.');
        setPendingFollowUp((prev) =>
          prev && prev.habitId ? { ...prev, taskId: null } : null
        );
        void fetchData();
      } else {
        notify(json.error || 'Bağlı görev güncellenemedi.', 'err');
      }
    } catch {
      notify('Bağlı görev güncellenirken hata oluştu.', 'err');
    } finally {
      setFollowUpBusy(false);
    }
  };

  const handleConfirmLinkedHabit = async () => {
    if (!pendingFollowUp?.habitId || followUpBusy) return;
    setFollowUpBusy(true);
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_log',
          habit_id: pendingFollowUp.habitId,
          date: pendingFollowUp.blockDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify('🔁 Bağlı alışkanlık kaydedildi.');
        setPendingFollowUp((prev) =>
          prev && prev.taskId ? { ...prev, habitId: null } : null
        );
        void fetchData();
      } else {
        notify(json.error || 'Bağlı alışkanlık güncellenemedi.', 'err');
      }
    } catch {
      notify('Bağlı alışkanlık güncellenirken hata oluştu.', 'err');
    } finally {
      setFollowUpBusy(false);
    }
  };

  const handleDelete = async (block: TimeBlockItem) => {
    if (deletingIds.has(block.id)) return;
    setDeletingIds((prev) => new Set(prev).add(block.id));
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: block.id }),
      });
      const json = await res.json();
      if (json.success) {
        setBlocks((prev) => prev.filter((b) => b.id !== block.id));
        notify('Zaman bloğu silindi.');
        void fetchData();
      } else {
        notify(json.error || 'Silinemedi.', 'err');
      }
    } catch {
      notify('Silme sırasında hata oluştu.', 'err');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(block.id);
        return next;
      });
    }
  };

  const handleStartFocus = async (block: TimeBlockItem) => {
    if (!block.linked_task_id) return;
    const duration = Math.max(
      15,
      Math.min(
        90,
        parseTimeToMinutes(block.end_time) - parseTimeToMinutes(block.start_time) || 25
      )
    );
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_focus',
          task_id: block.linked_task_id,
          duration_minutes: duration,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(`"${block.title}" için ${duration} dk odak oturumu başlatıldı.`);
      } else {
        notify(json.error || 'Odak başlatılamadı.', 'err');
      }
    } catch {
      notify('Odak oturumu başlatılamadı.', 'err');
    }
  };

  const handleQuickScheduleTask = async (task: UnscheduledTask) => {
    const slot = findNextAvailableSlot(dailyBlocks, '10:00', 60);
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_task',
          task_id: task.id,
          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          auto_slot: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const finalStart = json.data?.start_time || slot.start_time;
        const finalEnd = json.data?.end_time || slot.end_time;
        notify(
          slot.shifted || json.shifted
            ? `"${task.title}" boş aralığa (${finalStart}–${finalEnd}) planlandı.`
            : `"${task.title}" ${selectedDate} ${finalStart}–${finalEnd} aralığına planlandı.`
        );
        void fetchData();
      } else {
        notify(json.error || 'Planlanamadı.', 'err');
      }
    } catch {
      notify('Planlama hatası.', 'err');
    }
  };

  const handleQuickScheduleBook = async (book: ActiveBook) => {
    const slot = findNextAvailableSlot(dailyBlocks, '21:00', 45);
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_book',
          book_id: book.id,
          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          auto_slot: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const finalStart = json.data?.start_time || slot.start_time;
        const finalEnd = json.data?.end_time || slot.end_time;
        notify(
          slot.shifted || json.shifted
            ? `"${book.title}" boş aralığa (${finalStart}–${finalEnd}) planlandı.`
            : `"${book.title}" okuma bloğu (${finalStart}–${finalEnd}) eklendi.`
        );
        void fetchData();
      } else {
        notify(json.error || 'Planlanamadı.', 'err');
      }
    } catch {
      notify('Planlama hatası.', 'err');
    }
  };

  const handleQuickScheduleHabit = async (habit: ActiveHabit) => {
    const slot = findNextAvailableSlot(dailyBlocks, '08:00', 30);
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_habit',
          habit_id: habit.id,
          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          auto_slot: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const finalStart = json.data?.start_time || slot.start_time;
        const finalEnd = json.data?.end_time || slot.end_time;
        notify(
          slot.shifted || json.shifted
            ? `"${habit.title}" boş aralığa (${finalStart}–${finalEnd}) planlandı.`
            : `"${habit.title}" rutin bloğu (${finalStart}–${finalEnd}) eklendi.`
        );
        void fetchData();
      } else {
        notify(json.error || 'Planlanamadı.', 'err');
      }
    } catch {
      notify('Planlama hatası.', 'err');
    }
  };

  const stepPeriod = (dir: -1 | 1) => {
    const delta = viewMode === 'weekly' ? dir * 7 : dir;
    setSelectedDate((prev) => shiftTurkeyDate(prev, delta));
  };

  const sharedCount = useMemo(
    () => blocks.filter((b) => b.is_family_shared === 1).length,
    [blocks]
  );

  const totalUnscheduledCount =
    unscheduledTasks.length + activeBooks.length + activeHabits.length;

  if (!initialLoaded && loading) {
    return (
      <PageLoadingState
        icon="📅"
        title="Zaman Bloklama & Ajanda Yükleniyor..."
        description="Türkiye saatiyle günlük/haftalık zaman blokları, çakışma analizi ve görev/okuma/rutin köprüsü hazırlanıyor"
        color="#6366F1"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', minWidth: 0 }}>
      {toast && (
        <div
          className="toast-glass"
          role="status"
          aria-live="polite"
          style={{
            zIndex: 1100,
            borderColor: toast.type === 'err' ? 'var(--rose)' : 'rgba(16, 185, 129, 0.45)',
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Üst Başlık & Görünüm Kontrolleri */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 900,
              margin: 0,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CalendarIcon size={22} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
            <span>Zaman Bloklama &amp; Haftalık Ajanda</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
            Gününü saatlik bloklara ayır, çakışmaları yakala ve görev, kitap veya alışkanlık hedeflerini takvime yerleştir.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Günlük / Haftalık Seçici */}
          <div
            role="group"
            aria-label="Görünüm Modu"
            style={{
              display: 'inline-flex',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '999px',
              padding: '3px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                background: viewMode === 'daily' ? 'var(--indigo)' : 'transparent',
                color: viewMode === 'daily' ? '#FFFFFF' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              📅 Günlük
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                background: viewMode === 'weekly' ? 'var(--indigo)' : 'transparent',
                color: viewMode === 'weekly' ? '#FFFFFF' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              📆 Haftalık
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDrawer((v) => !v)}
            className="btn-subtle"
            style={{
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '999px',
              borderColor: showDrawer ? 'var(--indigo)' : 'var(--border)',
              color: showDrawer ? 'var(--indigo)' : 'var(--text-main)',
            }}
          >
            📥 Planlanmamışlar ({totalUnscheduledCount})
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="btn-primary"
            style={{
              width: 'auto',
              marginTop: 0,
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Plus size={15} />
            <span>Yeni Blok</span>
          </button>
        </div>
      </div>

      {/* Tarih Gezgini */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => stepPeriod(-1)}
            className="btn-subtle"
            style={{ padding: '7px 10px', minWidth: '36px', minHeight: '36px' }}
            aria-label="Önceki dönem"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="btn-subtle"
            style={{
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 800,
              minHeight: '36px',
              borderColor: selectedDate === today ? 'var(--indigo)' : 'var(--border)',
              color: selectedDate === today ? 'var(--indigo)' : 'var(--text-main)',
            }}
          >
            Bugün (TR)
          </button>
          <button
            type="button"
            onClick={() => stepPeriod(1)}
            className="btn-subtle"
            style={{ padding: '7px 10px', minWidth: '36px', minHeight: '36px' }}
            aria-label="Sonraki dönem"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--text-main)',
          }}
        >
          {viewMode === 'weekly'
            ? `${formatTurkishDisplayDate(weekDates[0], false)} – ${formatTurkishDisplayDate(
                weekDates[6],
                true
              )}`
            : formatTurkishDisplayDate(selectedDate, true)}
        </div>
      </div>

      {/* Bağlı Görev / Alışkanlık Onaylı Geri-Yazım Şeridi */}
      {pendingFollowUp && (pendingFollowUp.taskId || pendingFollowUp.habitId) && (
        <div
          className="card"
          role="region"
          aria-label="Bağlı kayıt tamamlama onayı"
          style={{
            padding: '12px 16px',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            borderColor: 'var(--emerald)',
            background: 'var(--emerald-bg)',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-main)' }}>
              🎉 &ldquo;{pendingFollowUp.blockTitle}&rdquo; bloğu tamamlandı
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Bu bloğa bağlı kaydı da tamamlandı olarak işaretlemek ister misiniz?
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {pendingFollowUp.taskId && (
              <button
                type="button"
                disabled={followUpBusy}
                onClick={handleConfirmLinkedTask}
                className="btn-primary"
                style={{
                  width: 'auto',
                  marginTop: 0,
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '999px',
                }}
              >
                ✅ Bağlı Görevi Tamamla
              </button>
            )}
            {pendingFollowUp.habitId && (
              <button
                type="button"
                disabled={followUpBusy}
                onClick={handleConfirmLinkedHabit}
                className="btn-primary"
                style={{
                  width: 'auto',
                  marginTop: 0,
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '999px',
                }}
              >
                🔁 Bağlı Alışkanlığı İşaretle
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingFollowUp(null)}
              className="btn-subtle"
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '999px',
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI Özeti */}
      <div className="calendar-kpi-grid">
        <div className="card" style={{ padding: '14px 16px', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Planlanan Süre
          </div>
          <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-main)' }}>
            {formatMinutesToDuration(summary.totalMinutes)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {summary.totalBlocks} zaman bloğu
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Tamamlanma
          </div>
          <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 900, color: 'var(--emerald)' }}>
            %{summary.completionRate}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {summary.completedBlocks}/{summary.totalBlocks} blok ({formatMinutesToDuration(summary.completedMinutes)})
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Çakışma Kontrolü
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: summary.conflictCount > 0 ? 'var(--amber)' : 'var(--emerald)',
            }}
          >
            {summary.conflictCount > 0 ? `${summary.conflictCount} Çakışma` : 'Temiz'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {summary.conflictCount > 0 ? 'Aynı saatte üst üste bloklar var' : 'Saat aralıkları uyumlu'}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Aile Paylaşımı
          </div>
          <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 900, color: '#EC4899' }}>
            {sharedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Aileye açık zaman bloğu
          </div>
        </div>
      </div>

      {/* Planlanmamış Görev / Kitap / Alışkanlık Çekmecesi */}
      {showDrawer && (
        <div
          className="card"
          style={{
            padding: '16px',
            borderColor: 'rgba(99, 102, 241, 0.45)',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDrawerTab('tasks')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  border: `1px solid ${drawerTab === 'tasks' ? 'var(--indigo)' : 'var(--border)'}`,
                  background: drawerTab === 'tasks' ? 'var(--indigo-bg)' : 'var(--surface-subtle)',
                  color: drawerTab === 'tasks' ? 'var(--indigo)' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
              >
                <CheckSquare size={14} />
                <span>Görevler ({unscheduledTasks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('books')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  border: `1px solid ${drawerTab === 'books' ? 'var(--amber)' : 'var(--border)'}`,
                  background: drawerTab === 'books' ? 'var(--amber-bg)' : 'var(--surface-subtle)',
                  color: drawerTab === 'books' ? 'var(--amber)' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
              >
                <BookOpen size={14} />
                <span>Kitaplar ({activeBooks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('habits')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  border: `1px solid ${drawerTab === 'habits' ? '#06B6D4' : 'var(--border)'}`,
                  background: drawerTab === 'habits' ? 'rgba(6, 182, 212, 0.14)' : 'var(--surface-subtle)',
                  color: drawerTab === 'habits' ? '#06B6D4' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
              >
                <Repeat size={14} />
                <span>Alışkanlıklar ({activeHabits.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="modal-close-btn"
              aria-label="Çekmeceyi kapat"
            >
              <X size={15} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '10px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
          >
            {drawerTab === 'tasks' &&
              (unscheduledTasks.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', gridColumn: '1 / -1' }}>
                  Bekleyen görev bulunmuyor.
                </div>
              ) : (
                unscheduledTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-subtle)',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {PRIORITY_LABELS[t.priority] || t.priority}
                        {t.due_date ? ` • ${t.due_date}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleTask(t)}
                      className="btn-subtle"
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderColor: 'var(--indigo)',
                        color: 'var(--indigo)',
                        flexShrink: 0,
                      }}
                    >
                      + Planla ({nextTaskSlot.start_time})
                    </button>
                  </div>
                ))
              ))}

            {drawerTab === 'books' &&
              (activeBooks.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', gridColumn: '1 / -1' }}>
                  Şu an okunan kitap bulunmuyor.
                </div>
              ) : (
                activeBooks.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-subtle)',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {b.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Sayfa {b.current_page}/{b.total_pages}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleBook(b)}
                      className="btn-subtle"
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderColor: 'var(--amber)',
                        color: 'var(--amber)',
                        flexShrink: 0,
                      }}
                    >
                      + {nextBookSlot.start_time}
                    </button>
                  </div>
                ))
              ))}

            {drawerTab === 'habits' &&
              (activeHabits.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px', gridColumn: '1 / -1' }}>
                  Aktif alışkanlık bulunmuyor.
                </div>
              ) : (
                activeHabits.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-subtle)',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {resolveHabitEmoji(h.icon)} {h.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleHabit(h)}
                      className="btn-subtle"
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderColor: '#06B6D4',
                        color: '#06B6D4',
                        flexShrink: 0,
                      }}
                    >
                      + {nextHabitSlot.start_time}
                    </button>
                  </div>
                ))
              ))}
          </div>
        </div>
      )}

      {/* Ana Görünüm: Günlük veya Haftalık */}
      {viewMode === 'daily' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dailyBlocks.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                alignItems: 'center',
                borderStyle: 'dashed',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '28px' }}>📅</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                {formatTurkishDisplayDate(selectedDate, true)} için planlanmış zaman bloğu yok
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '420px' }}>
                Yeni bir saat bloğu oluşturabilir veya &ldquo;Planlanmamışlar&rdquo; çekmecesinden görev, kitap ve alışkanlıklarınızı tek tıkla ekleyebilirsiniz.
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(selectedDate)}
                className="btn-primary"
                style={{
                  width: 'auto',
                  marginTop: '4px',
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={15} />
                <span>İlk Bloğu Ekle</span>
              </button>
            </div>
          ) : (
            dailyBlocks.map((block) => {
              const meta = getTimeBlockCategoryMeta(block.category);
              const isConflict = conflictIds.has(block.id);
              const dur =
                parseTimeToMinutes(block.end_time) - parseTimeToMinutes(block.start_time);

              return (
                <div
                  key={block.id}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderColor: isConflict
                      ? 'var(--amber)'
                      : block.is_completed === 1
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'var(--border)',
                    borderLeftWidth: '4px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: block.color || meta.color,
                    opacity: block.is_completed === 1 ? 0.78 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(block)}
                      aria-label="Tamamlandı olarak işaretle"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '7px',
                        border: `1.5px solid ${block.is_completed === 1 ? 'var(--emerald)' : 'var(--border-strong)'}`,
                        background: block.is_completed === 1 ? 'var(--emerald)' : 'var(--surface-subtle)',
                        color: '#FFFFFF',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {block.is_completed === 1 && <Check size={14} />}
                    </button>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'var(--indigo-bg)',
                            color: 'var(--indigo)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={12} />
                          {block.start_time} – {block.end_time} ({formatMinutesToDuration(dur)})
                        </span>

                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {meta.emoji} {meta.label}
                        </span>

                        {isConflict && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'var(--amber-bg)',
                              color: 'var(--amber)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <AlertTriangle size={12} />
                            Çakışma
                          </span>
                        )}

                        {block.is_family_shared === 1 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(236, 72, 153, 0.14)',
                              color: '#EC4899',
                              border: '1px solid rgba(236, 72, 153, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Users size={12} />
                            <span>
                              Aile
                              {block.owner_name
                                ? ` • ${block.owner_avatar || '👤'} ${block.owner_name}`
                                : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: block.is_completed === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: block.is_completed === 1 ? 'line-through' : 'none',
                          marginTop: '6px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {block.title}
                      </div>

                      {block.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {block.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {block.linked_task_id && (
                      <button
                        type="button"
                        onClick={() => handleStartFocus(block)}
                        className="btn-subtle"
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          borderColor: 'var(--emerald)',
                          color: 'var(--emerald)',
                        }}
                      >
                        <Play size={13} />
                        <span>Odaklan</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(block)}
                      className="btn-subtle"
                      style={{ padding: '7px 9px' }}
                      aria-label="Düzenle"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      type="button"
                      disabled={deletingIds.has(block.id)}
                      onClick={() => handleDelete(block)}
                      className="btn-subtle"
                      style={{
                        padding: '7px 9px',
                        color: 'var(--rose)',
                        opacity: deletingIds.has(block.id) ? 0.5 : 1,
                      }}
                      aria-label="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="calendar-week-grid">
          {weekDates.map((dateStr) => {
            const dayBlocks = blocks
              .filter((b) => b.date === dateStr)
              .sort(
                (a, b) =>
                  parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
              );
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <div
                key={dateStr}
                className="card"
                style={{
                  padding: '12px',
                  minHeight: '240px',
                  gap: '10px',
                  borderColor: isToday
                    ? 'var(--indigo)'
                    : isSelected
                    ? 'var(--border-strong)'
                    : 'var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border)',
                    gap: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setViewMode('daily');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {getShortTurkishDayName(dateStr)}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: '14px',
                        fontWeight: 900,
                        color: isToday ? 'var(--indigo)' : 'var(--text-main)',
                      }}
                    >
                      {dateStr.slice(8, 10)}.{dateStr.slice(5, 7)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openCreateModal(dateStr)}
                    className="btn-subtle"
                    style={{ padding: '5px 7px', borderRadius: '8px' }}
                    aria-label={`${dateStr} gününe blok ekle`}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {dayBlocks.length === 0 ? (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '18px 4px',
                      }}
                    >
                      Boş
                    </div>
                  ) : (
                    dayBlocks.map((b) => {
                      const isConflict = conflictIds.has(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => openEditModal(b)}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '10px',
                            padding: '8px 9px',
                            background: 'var(--surface-subtle)',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: isConflict ? 'var(--amber)' : 'var(--border)',
                            borderLeftWidth: '3px',
                            borderLeftColor: b.color || '#3B82F6',
                            opacity: b.is_completed === 1 ? 0.65 : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '4px',
                              minWidth: 0,
                            }}
                          >
                            <span
                              className="tabular-nums"
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {b.start_time}–{b.end_time}
                            </span>

                            <button
                              type="button"
                              aria-label={`${b.title} tamamla`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleToggleComplete(b);
                              }}
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '5px',
                                border: `1px solid ${b.is_completed === 1 ? 'var(--emerald)' : 'var(--border-strong)'}`,
                                background: b.is_completed === 1 ? 'var(--emerald)' : 'var(--surface)',
                                color: '#FFFFFF',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {b.is_completed === 1 && <Check size={11} />}
                            </button>
                          </div>

                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              color: b.is_completed === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                              textDecoration: b.is_completed === 1 ? 'line-through' : 'none',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                            }}
                          >
                            {b.title}
                          </div>

                          {b.is_family_shared === 1 && (
                            <div
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#EC4899',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {b.owner_name
                                ? `${b.owner_avatar || '👤'} ${b.owner_name}`
                                : '👨‍👩‍👧 Aile'}
                            </div>
                          )}

                          {isConflict && (
                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--amber)' }}>
                              ⚠️ Çakışma
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Yeni / Düzenle Modalı */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setModalOpen(false)}
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingBlock ? 'Zaman Bloğunu Düzenle' : 'Yeni Zaman Bloğu'}
            style={{ maxWidth: '480px', width: '100%', padding: '20px' }}
          >
            <div className="modal-header">
              <h2 className="modal-title" style={{ margin: 0 }}>
                {editingBlock ? '⏱️ Zaman Bloğunu Düzenle' : '📅 Yeni Zaman Bloğu'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="modal-close-btn"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveBlock}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Başlık *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Örn: Mimari Tasarım & Derin Odak"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                    }}
                    required
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Başlangıç
                  </label>
                  <input
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                    }}
                    required
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Bitiş
                  </label>
                  <input
                    type="time"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Kategori
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                >
                  {TIME_BLOCK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Modül Bağlantısı (Opsiyonel: Görev / Kitap / Alışkanlık)
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '6px',
                    }}
                  >
                    <select
                      value={formLinkedTaskId}
                      onChange={(e) => setFormLinkedTaskId(e.target.value)}
                      aria-label="Bağlı Görev"
                      style={{
                        width: '100%',
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                      }}
                    >
                      <option value="">✅ Görev Yok</option>
                      {formLinkedTaskId &&
                        !unscheduledTasks.some((t) => t.id === formLinkedTaskId) && (
                          <option value={formLinkedTaskId}>
                            ✅ Mevcut Bağlı Görev
                          </option>
                        )}
                      {unscheduledTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={formLinkedBookId}
                      onChange={(e) => setFormLinkedBookId(e.target.value)}
                      aria-label="Bağlı Kitap"
                      style={{
                        width: '100%',
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                      }}
                    >
                      <option value="">📚 Kitap Yok</option>
                      {formLinkedBookId &&
                        !activeBooks.some((b) => b.id === formLinkedBookId) && (
                          <option value={formLinkedBookId}>
                            📚 Mevcut Bağlı Kitap
                          </option>
                        )}
                      {activeBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={formLinkedHabitId}
                      onChange={(e) => setFormLinkedHabitId(e.target.value)}
                      aria-label="Bağlı Alışkanlık"
                      style={{
                        width: '100%',
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                      }}
                    >
                      <option value="">🔁 Alışkanlık Yok</option>
                      {formLinkedHabitId &&
                        !activeHabits.some((h) => h.id === formLinkedHabitId) && (
                          <option value={formLinkedHabitId}>
                            🔁 Mevcut Bağlı Alışkanlık
                          </option>
                        )}
                      {activeHabits.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Notlar
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Opsiyonel detay veya hedef..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={formShared}
                  onChange={(e) => setFormShared(e.target.checked)}
                />
                <span>Aileyle Paylaş (ortak aile takviminde görünsün)</span>
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {editingBlock && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(editingBlock);
                      setModalOpen(false);
                    }}
                    className="btn-subtle"
                    style={{
                      marginRight: 'auto',
                      color: 'var(--rose)',
                      borderColor: 'rgba(244, 63, 94, 0.35)',
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Sil</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-subtle"
                >
                  İptal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                  style={{
                    width: 'auto',
                    marginTop: 0,
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (min-width: 900px) {
          .calendar-kpi-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .calendar-week-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .calendar-week-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 960px) {
          .calendar-week-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (min-width: 1200px) {
          .calendar-week-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
