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
  formatMinutesToDuration,
  getTimeBlockCategoryMeta,
  getTurkeyWeekDates,
  parseTimeToMinutes,
} from '@/lib/time-blocks-engine';

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

export default function CalendarClient() {
  const today = useMemo(() => getTodayTurkeyDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');
  const [blocks, setBlocks] = useState<TimeBlockItem[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<UnscheduledTask[]>([]);
  const [activeBooks, setActiveBooks] = useState<ActiveBook[]>([]);
  const [activeHabits, setActiveHabits] = useState<ActiveHabit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
  const [saving, setSaving] = useState<boolean>(false);

  const notify = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
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
    }
  }, [rangeFrom, rangeTo, notify]);

  useEffect(() => {
    fetchData();
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

  const openCreateModal = (presetDate?: string) => {
    setEditingBlock(null);
    setFormTitle('');
    setFormDate(presetDate || selectedDate);
    setFormStart('09:00');
    setFormEnd('10:00');
    setFormCategory('deep_work');
    setFormNotes('');
    setFormShared(false);
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
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(editingBlock ? 'Zaman bloğu güncellendi.' : 'Zaman bloğu eklendi.');
        setModalOpen(false);
        fetchData();
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
            b.id === block.id ? { ...b, is_completed: b.is_completed === 1 ? 0 : 1 } : b
          )
        );
      } else {
        notify(json.error || 'Güncellenemedi.', 'err');
      }
    } catch {
      notify('Bağlantı hatası.', 'err');
    }
  };

  const handleDelete = async (block: TimeBlockItem) => {
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: block.id }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Zaman bloğu silindi.');
        fetchData();
      } else {
        notify(json.error || 'Silinemedi.', 'err');
      }
    } catch {
      notify('Silme sırasında hata oluştu.', 'err');
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
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_task',
          task_id: task.id,
          date: selectedDate,
          start_time: '10:00',
          end_time: '11:00',
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(`"${task.title}" ${selectedDate} gününe planlandı.`);
        fetchData();
      } else {
        notify(json.error || 'Planlanamadı.', 'err');
      }
    } catch {
      notify('Planlama hatası.', 'err');
    }
  };

  const handleQuickScheduleBook = async (book: ActiveBook) => {
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_book',
          book_id: book.id,
          date: selectedDate,
          start_time: '21:00',
          end_time: '21:45',
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(`"${book.title}" okuma bloğu eklendi.`);
        fetchData();
      } else {
        notify(json.error || 'Planlanamadı.', 'err');
      }
    } catch {
      notify('Planlama hatası.', 'err');
    }
  };

  const handleQuickScheduleHabit = async (habit: ActiveHabit) => {
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: `${habit.icon} ${habit.title}`,
          category: 'personal',
          date: selectedDate,
          start_time: '08:00',
          end_time: '08:30',
          color: habit.color || '#06B6D4',
          linked_habit_id: habit.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(`"${habit.title}" rutin bloğu eklendi.`);
        fetchData();
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${
            toast.type === 'ok'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/90 border-rose-700 text-rose-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-indigo-400" />
            Zaman Bloklama & Haftalık Ajanda
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gününü saatlik bloklara ayır, çakışmaları yakala ve görev/okuma hedeflerini takvime yerleştir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'daily'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📅 Günlük
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'weekly'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📆 Haftalık
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDrawer((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 text-xs font-medium transition"
          >
            Planlanmamışlar ({unscheduledTasks.length + activeBooks.length})
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Blok
          </button>
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepPeriod(-1)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            aria-label="Önceki"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
          >
            Bugün (TR)
          </button>
          <button
            type="button"
            onClick={() => stepPeriod(1)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            aria-label="Sonraki"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm font-semibold text-slate-200">
          {viewMode === 'weekly'
            ? `${formatTurkishDisplayDate(weekDates[0], false)} – ${formatTurkishDisplayDate(
                weekDates[6],
                true
              )}`
            : formatTurkishDisplayDate(selectedDate, true)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Planlanan Süre</div>
          <div className="text-xl font-bold text-slate-100 mt-1">
            {formatMinutesToDuration(summary.totalMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.totalBlocks} zaman bloğu
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Tamamlanma</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            %{summary.completionRate}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.completedBlocks}/{summary.totalBlocks} blok tamamlandı
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Çakışma Kontrolü</div>
          <div
            className={`text-xl font-bold mt-1 ${
              summary.conflictCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {summary.conflictCount > 0 ? `${summary.conflictCount} Çakışma` : 'Temiz'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.conflictCount > 0 ? 'Aynı saatte üst üste bloklar var' : 'Saatler uyumlu'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Aile Paylaşımı</div>
          <div className="text-xl font-bold text-pink-400 mt-1">{sharedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Aileye açık zaman bloğu
          </div>
        </div>
      </div>

      {/* Unscheduled Drawer */}
      {showDrawer && (
        <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerTab('tasks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  drawerTab === 'tasks'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Görevler ({unscheduledTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('books')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  drawerTab === 'books'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Kitaplar ({activeBooks.length})
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('habits')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  drawerTab === 'habits'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                Alışkanlıklar ({activeHabits.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
            {drawerTab === 'tasks' &&
              (unscheduledTasks.length === 0 ? (
                <div className="text-xs text-slate-500 col-span-full py-2">
                  Bekleyen görev bulunmuyor.
                </div>
              ) : (
                unscheduledTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Öncelik: {t.priority}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleTask(t)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-medium transition"
                    >
                      + Planla
                    </button>
                  </div>
                ))
              ))}

            {drawerTab === 'books' &&
              (activeBooks.length === 0 ? (
                <div className="text-xs text-slate-500 col-span-full py-2">
                  Şu an okunan kitap bulunmuyor.
                </div>
              ) : (
                activeBooks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {b.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Sayfa {b.current_page}/{b.total_pages}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleBook(b)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-[11px] font-medium transition"
                    >
                      + 21:00
                    </button>
                  </div>
                ))
              ))}

            {drawerTab === 'habits' &&
              (activeHabits.length === 0 ? (
                <div className="text-xs text-slate-500 col-span-full py-2">
                  Aktif alışkanlık bulunmuyor.
                </div>
              ) : (
                activeHabits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {h.icon} {h.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduleHabit(h)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white text-[11px] font-medium transition"
                    >
                      + 08:00
                    </button>
                  </div>
                ))
              ))}
          </div>
        </div>
      )}

      {/* Main View */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-400">
          Zaman blokları yükleniyor...
        </div>
      ) : viewMode === 'daily' ? (
        <div className="space-y-3">
          {dailyBlocks.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <div className="text-sm text-slate-400">
                {formatTurkishDisplayDate(selectedDate, true)} için planlanmış zaman bloğu yok.
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(selectedDate)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                İlk Bloğu Ekle
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
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 border rounded-2xl p-4 transition ${
                    isConflict
                      ? 'border-amber-500/60'
                      : block.is_completed === 1
                      ? 'border-emerald-500/30 opacity-75'
                      : 'border-slate-800'
                  }`}
                  style={{ borderLeftWidth: '4px', borderLeftColor: block.color || meta.color }}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(block)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                        block.is_completed === 1
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-600 hover:border-indigo-400'
                      }`}
                      aria-label="Tamamlandı olarak işaretle"
                    >
                      {block.is_completed === 1 && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {block.start_time} – {block.end_time} ({formatMinutesToDuration(dur)})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {meta.emoji} {meta.label}
                        </span>
                        {isConflict && (
                          <span className="text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Çakışma
                          </span>
                        )}
                        {block.is_family_shared === 1 && (
                          <span className="text-[11px] bg-pink-500/15 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Aile
                          </span>
                        )}
                      </div>

                      <div
                        className={`text-sm font-semibold mt-1.5 ${
                          block.is_completed === 1
                            ? 'line-through text-slate-400'
                            : 'text-slate-100'
                        }`}
                      >
                        {block.title}
                      </div>
                      {block.notes && (
                        <div className="text-xs text-slate-400 mt-1">{block.notes}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {block.linked_task_id && (
                      <button
                        type="button"
                        onClick={() => handleStartFocus(block)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Odaklan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(block)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      aria-label="Düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(block)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300"
                      aria-label="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
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
                className={`bg-slate-900/60 border rounded-2xl p-3 flex flex-col min-h-[260px] ${
                  isToday
                    ? 'border-indigo-500/60'
                    : isSelected
                    ? 'border-slate-600'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setViewMode('daily');
                    }}
                    className="text-left hover:text-indigo-300 transition"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      {getShortTurkishDayName(dateStr)}
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        isToday ? 'text-indigo-400' : 'text-slate-200'
                      }`}
                    >
                      {dateStr.slice(8, 10)}.{dateStr.slice(5, 7)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal(dateStr)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                    aria-label="Bu güne blok ekle"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 flex-1">
                  {dayBlocks.length === 0 ? (
                    <div className="text-[11px] text-slate-600 py-4 text-center">
                      Boş
                    </div>
                  ) : (
                    dayBlocks.map((b) => {
                      const isConflict = conflictIds.has(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => openEditModal(b)}
                          className={`cursor-pointer rounded-xl p-2 bg-slate-950/80 border text-xs transition hover:border-slate-600 ${
                            isConflict ? 'border-amber-500/60' : 'border-slate-800'
                          } ${b.is_completed === 1 ? 'opacity-60' : ''}`}
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor: b.color || '#3B82F6',
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                            <span>
                              {b.start_time}-{b.end_time}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleComplete(b);
                              }}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                b.is_completed === 1
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-600'
                              }`}
                            >
                              {b.is_completed === 1 && <Check className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                          <div
                            className={`font-medium mt-1 line-clamp-2 ${
                              b.is_completed === 1
                                ? 'line-through text-slate-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {b.title}
                          </div>
                          {isConflict && (
                            <div className="text-[10px] text-amber-400 mt-1">
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">
                {editingBlock ? 'Zaman Bloğunu Düzenle' : 'Yeni Zaman Bloğu'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBlock} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Başlık</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Örn: Mimari Tasarım Odak"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Başlangıç</label>
                  <input
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bitiş</label>
                  <input
                    type="time"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Kategori</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  {TIME_BLOCK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Notlar</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Opsiyonel detay..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formShared}
                  onChange={(e) => setFormShared(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950"
                />
                Aileyle Paylaş (ortak takvimde görünsün)
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingBlock && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(editingBlock);
                      setModalOpen(false);
                    }}
                    className="mr-auto px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-medium"
                  >
                    Sil
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
