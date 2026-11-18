'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  CheckCircle2,
  Circle,
  Flame,
  Calendar,
  Clock,
  Repeat,
  Users,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  ArrowRight,
  Filter,
  CheckSquare,
  Search,
  Play,
  Pause,
  Timer,
  X
} from 'lucide-react';
import {
  TaskItem,
  TaskPillar,
  TaskPriority,
  CrossModuleAction,
  CrossModuleFollowUp,
  VirtualRecurrenceItem,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS,
  ALLOWED_FOCUS_DURATIONS,
  summarizeTodayMit,
  filterTasksByView,
  filterTasksByDate,
  filterTasksByScope,
  filterCrossModuleActionsByScope,
  computeTaskTabCounts,
  sortTasksForDisplay,
  formatTaskScheduleLabel,
  getOverdueTasks,
  buildMaterializedRecurrenceDraft,
  computeFocusCountdown,
  formatFocusDurationSummary,
  resolveCrossModuleFollowUp
} from '@/lib/tasks-engine';
import { getTodayTurkeyDate, shiftTurkeyDate, formatTurkishDisplayDate } from '@/lib/date-utils';
import AddTaskModal from '@/components/modals/AddTaskModal';
import TaskCalendarPanel from '@/components/tasks/TaskCalendarPanel';

interface TasksClientProps {
  initialData?: any;
  isCalendarOpen?: boolean;
  onCloseCalendar?: () => void;
  onRefresh?: () => Promise<void> | void;
}

export default function TasksClient({
  initialData,
  isCalendarOpen,
  onCloseCalendar,
  onRefresh
}: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialData?.tasks || []);
  const [crossModuleActions, setCrossModuleActions] = useState<CrossModuleAction[]>(initialData?.crossModuleActions || []);
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar: string }>>(initialData?.members || []);
  const [importingActionId, setImportingActionId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'backlog' | 'recurring' | 'bridge' | 'completed'>('today');
  const [filterType, setFilterType] = useState<'all' | 'personal' | 'family'>('all');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [focusDurationMinutes, setFocusDurationMinutes] = useState<number>(25);
  const [focusSubmittingId, setFocusSubmittingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [internalCalendarOpen, setInternalCalendarOpen] = useState(false);

  const calendarOpen = isCalendarOpen ?? internalCalendarOpen;
  const closeCalendar = onCloseCalendar ?? (() => setInternalCalendarOpen(false));

  const [loading, setLoading] = useState(!initialData);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [completedFollowUp, setCompletedFollowUp] = useState<(CrossModuleFollowUp & { taskTitle: string }) | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Açık alt görev kutuları
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const captureFollowUp = (taskId: string, followUp?: CrossModuleFollowUp | null) => {
    if (!followUp) return;
    const matched = tasks.find(t => t.id === taskId);
    setCompletedFollowUp({
      taskTitle: matched?.title || 'Tamamlanan Görev',
      ...followUp
    });
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (json.success && json.data) {
        setTasks(json.data.tasks || []);
        setCrossModuleActions(json.data.crossModuleActions || []);
        setMembers(json.data.members || []);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncTasks = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      await fetchTasks();
    }
  };

  useEffect(() => {
    if (initialData) {
      setTasks(initialData.tasks || []);
      setCrossModuleActions(initialData.crossModuleActions || []);
      setMembers(initialData.members || []);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData) {
      fetchTasks();
    }
  }, []);

  const handleToggleComplete = async (taskId: string) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const isDone = t.status === 'completed';
          return {
            ...t,
            status: isDone ? 'pending' : 'completed',
            completed_at: isDone ? null : new Date().toISOString(),
            ...(!isDone ? { focus_started_at: null } : {})
          };
        }
        return t;
      }));

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_complete', task_id: taskId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        captureFollowUp(taskId, json.data?.follow_up_action);
        await syncTasks();
      } else {
        showToast(json.error || 'İşlem başarısız.');
        await syncTasks();
      }
    } catch {
      await syncTasks();
    }
  };

  const handleToggleMit = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_mit', task_id: taskId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        await syncTasks();
      } else {
        showToast(json.error || 'Odak görevi eklenemedi.');
      }
    } catch {
      showToast('Bağlantı hatası.');
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => {
        if (t.id === taskId && t.subtasks) {
          const updatedSubtasks = t.subtasks.map(s => {
            if (s.id === subtaskId) return { ...s, is_completed: !s.is_completed };
            return s;
          });
          const completedCount = updatedSubtasks.filter(s => s.is_completed).length;
          const allDone = updatedSubtasks.length > 0 && completedCount === updatedSubtasks.length;
          const wasDone = t.status === 'completed';
          const statusPatch = allDone && !wasDone
            ? { status: 'completed' as const, completed_at: new Date().toISOString(), focus_started_at: null }
            : !allDone && wasDone
              ? { status: 'pending' as const, completed_at: null }
              : {};
          return {
            ...t,
            ...statusPatch,
            subtasks: updatedSubtasks,
            subtasks_progress: {
              total: updatedSubtasks.length,
              completed: completedCount,
              percent: Math.round((completedCount / updatedSubtasks.length) * 100)
            }
          };
        }
        return t;
      }));

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_subtask', task_id: taskId, subtask_id: subtaskId })
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || 'Adım güncellenemedi.');
        await syncTasks();
        return;
      }
      if (json.data?.transition && json.data.transition !== 'none') {
        if (json.message) showToast(json.message);
        captureFollowUp(taskId, json.data?.follow_up_action);
        await syncTasks();
      }
    } catch {
      await syncTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', task_id: taskId })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Görev silindi.');
        await syncTasks();
      } else {
        showToast(json.error || 'Görev silinemedi.');
      }
    } catch {
      showToast('Görev silinirken hata oluştu.');
    }
  };

  const handleImportCrossModule = async (action: CrossModuleAction) => {
    if (importingActionId === action.id) return;
    setImportingActionId(action.id);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_cross_module',
          title: action.title,
          subtitle: action.subtitle,
          pillar: action.pillar,
          priority: action.priority,
          due_date: action.due_date,
          source_module: action.source_module,
          source_ref_id: action.source_ref_id,
          is_family_shared: action.is_family_shared
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || '✅ Görev listesine aktarıldı!');
        await syncTasks();
      } else {
        showToast(json.error || 'Aktarım başarısız.');
      }
    } catch {
      showToast('Aktarım sırasında hata oluştu.');
    } finally {
      setImportingActionId(null);
    }
  };

  const handleMaterializeRecurrence = (vr: VirtualRecurrenceItem) => {
    const templateTask = tasks.find(t => t.id === vr.sourceTaskId) || null;
    setEditingTask(buildMaterializedRecurrenceDraft(vr, templateTask) as any);
    setIsModalOpen(true);
  };

  const handleRescheduleTask = async (taskId: string, dueDate: string) => {
    if (reschedulingId) return;
    setReschedulingId(taskId);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', task_id: taskId, due_date: dueDate })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || '📅 Görev tarihi güncellendi.');
        await syncTasks();
      } else {
        showToast(json.error || 'Görev ertelenemedi.');
      }
    } catch {
      showToast('Erteleme sırasında hata oluştu.');
    } finally {
      setReschedulingId(null);
    }
  };

  const handleRescheduleAllOverdue = async (taskIds: string[]) => {
    if (reschedulingId || taskIds.length === 0) return;
    setReschedulingId('all');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule_overdue', task_ids: taskIds })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || '☀️ Gecikmiş görevler bugüne alındı.');
        await syncTasks();
      } else {
        showToast(json.error || 'Toplu erteleme başarısız.');
      }
    } catch {
      showToast('Toplu erteleme sırasında hata oluştu.');
    } finally {
      setReschedulingId(null);
    }
  };

  const runFocusAction = async (
    taskId: string,
    payload: Record<string, any>,
    fallbackError: string
  ) => {
    if (focusSubmittingId) return;
    setFocusSubmittingId(taskId);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, task_id: taskId })
      });
      const json = await res.json();
      if (json.success) {
        if (json.message) showToast(json.message);
        captureFollowUp(taskId, json.data?.follow_up_action);
        setNowMs(Date.now());
        await syncTasks();
      } else {
        showToast(json.error || fallbackError);
      }
    } catch {
      showToast('Odak zamanlayıcısı güncellenirken hata oluştu.');
    } finally {
      setFocusSubmittingId(null);
    }
  };

  const handleStartFocus = (taskId: string, durationMinutes: number = focusDurationMinutes) =>
    runFocusAction(taskId, { action: 'start_focus', duration_minutes: durationMinutes }, 'Odak seansı başlatılamadı.');

  const handlePauseFocus = (taskId: string) =>
    runFocusAction(taskId, { action: 'pause_focus' }, 'Odak seansı duraklatılamadı.');

  const handleCompleteFocus = (taskId: string, completeTask: boolean) =>
    runFocusAction(taskId, { action: 'complete_focus', complete_task: completeTask }, 'Odak seansı kaydedilemedi.');

  const toggleExpand = (id: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [todayStr, setTodayStr] = useState<string>(() => getTodayTurkeyDate());
  const todayRef = useRef(todayStr);
  todayRef.current = todayStr;
  const syncTasksRef = useRef(syncTasks);
  syncTasksRef.current = syncTasks;

  // Gece yarısı (00:00 TR) veya arka plandan dönüşte tarih değişimini canlı yakala
  useEffect(() => {
    const checkDayRollover = () => {
      const nextToday = getTodayTurkeyDate();
      if (nextToday !== todayRef.current) {
        todayRef.current = nextToday;
        setTodayStr(nextToday);
        void syncTasksRef.current();
      }
    };

    const intervalId = window.setInterval(checkDayRollover, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDayRollover();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkDayRollover);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkDayRollover);
    };
  }, []);

  const activeFocusTask = tasks.find(t => t.status === 'in_progress' && Boolean(t.focus_started_at)) || null;
  const activeFocusCountdown = activeFocusTask ? computeFocusCountdown(activeFocusTask, nowMs) : null;
  const baseDocTitleRef = useRef<string | null>(null);

  // Yalnızca aktif odak (Pomodoro) seansı varken 1 sn zamanlayıcı ve sekme başlığı senkronu
  useEffect(() => {
    if (!activeFocusTask || !activeFocusCountdown) {
      if (baseDocTitleRef.current !== null) {
        document.title = baseDocTitleRef.current;
        baseDocTitleRef.current = null;
      }
      return;
    }

    if (baseDocTitleRef.current === null) {
      baseDocTitleRef.current = document.title;
    }

    setNowMs(Date.now());
    const tickId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(tickId);
    };
  }, [activeFocusTask?.id, activeFocusTask?.focus_started_at, activeFocusTask?.focus_planned_minutes]);

  useEffect(() => {
    if (activeFocusTask && activeFocusCountdown) {
      const prefix = activeFocusCountdown.isFinished
        ? '✅ Süre Doldu!'
        : `⏱️ ${activeFocusCountdown.formattedRemaining}`;
      document.title = `${prefix} • ${activeFocusTask.title} | Singularity`;
    } else if (baseDocTitleRef.current !== null) {
      document.title = baseDocTitleRef.current;
      baseDocTitleRef.current = null;
    }
  }, [activeFocusTask?.id, activeFocusTask?.title, activeFocusCountdown?.formattedRemaining, activeFocusCountdown?.isFinished]);

  useEffect(() => {
    return () => {
      if (baseDocTitleRef.current !== null) {
        document.title = baseDocTitleRef.current;
        baseDocTitleRef.current = null;
      }
    };
  }, []);

  // MIT Görevleri (Günün 3 Odağı — Tek kaynak: tasks-engine)
  const { todayMitTasks, activeMitCount, completedMitCount } = summarizeTodayMit(tasks, todayStr);
  const mitTargetCount = Math.max(3, todayMitTasks.length);
  const mitSlots = Array.from({ length: mitTargetCount }, (_, i) => i);
  const mitPercent = Math.min(100, Math.round((completedMitCount / Math.max(1, activeMitCount + completedMitCount)) * 100)) || 0;

  // Görünüm ve Kapsam Filtreleme + Arama + Sıralama (Tek kaynak: tasks-engine)
  const effectiveSelectedMember = filterType === 'personal' ? 'all' : selectedMember;
  const scopedTasks = filterTasksByScope(tasks, {
    filterType,
    selectedPillar,
    selectedMember: effectiveSelectedMember,
    searchQuery
  });
  const scopedCrossModuleActions = filterCrossModuleActionsByScope(
    crossModuleActions,
    filterType,
    selectedPillar,
    searchQuery
  );
  const tabCounts = computeTaskTabCounts(scopedTasks, scopedCrossModuleActions, todayStr);
  const displayedTasks = selectedDate
    ? filterTasksByDate(scopedTasks, selectedDate)
    : sortTasksForDisplay(
        filterTasksByView(scopedTasks, activeTab === 'bridge' ? 'today' : activeTab, todayStr),
        activeTab
      );
  const overdueTasksInView = !selectedDate && activeTab === 'today'
    ? getOverdueTasks(displayedTasks, todayStr)
    : [];
  const hasActiveFilters = filterType !== 'all' || selectedPillar !== 'all' || effectiveSelectedMember !== 'all' || searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setFilterType('all');
    setSelectedPillar('all');
    setSelectedMember('all');
    setSearchQuery('');
  };

  const handleSelectCalendarDate = (dateStr: string | null) => {
    setSelectedDate(dateStr);
    if (dateStr && activeTab === 'bridge') {
      setActiveTab('today');
    }
  };

  const compactPrimaryBtnStyle: React.CSSProperties = {
    width: 'auto',
    marginTop: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  };

  const renderLeftAccent = (color: string) => (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: '10px',
        bottom: '10px',
        width: '4px',
        borderRadius: '0 4px 4px 0',
        background: color
      }}
    />
  );

  const actionIconBtnStyle = (highlight?: boolean, color?: string): React.CSSProperties => ({
    background: highlight ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-subtle)',
    border: `1px solid ${highlight ? 'rgba(245, 158, 11, 0.3)' : 'var(--border)'}`,
    borderRadius: '8px',
    minWidth: '44px',
    minHeight: '44px',
    width: '44px',
    height: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: color || 'var(--text-muted)',
    cursor: 'pointer',
    flexShrink: 0
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-glass" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}

      {/* Çift Yönlü Köprü Onay Kısayolu (Tamamlanan Köprü Görevi Sonrası) */}
      {completedFollowUp && (
        <div
          className="card"
          role="region"
          aria-label="Bağlı modül onay kısayolu"
          style={{
            padding: '12px 16px',
            borderColor: 'rgba(236, 72, 153, 0.45)',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(59, 130, 246, 0.06))',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              🌉 "{completedFollowUp.taskTitle}" tamamlandı — Kaynak Modüle İşle
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {completedFollowUp.description}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', maxWidth: '100%' }}>
            <Link
              href={completedFollowUp.href}
              className="btn-primary"
              style={{
                ...compactPrimaryBtnStyle,
                fontSize: '11px',
                padding: '6px 12px',
                textDecoration: 'none',
                fontWeight: 800
              }}
            >
              <span>{completedFollowUp.label}</span>
              <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={() => setCompletedFollowUp(null)}
              aria-label="Kısayolu kapat"
              style={{
                width: '32px',
                height: '32px',
                flexShrink: 0,
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 📅 AÇILIR/KAPANIR AYLIK GÖREV TAKVİMİ (Varsayılan kapalı) */}
      {calendarOpen && (
        <TaskCalendarPanel
          tasks={scopedTasks}
          crossModuleActions={scopedCrossModuleActions}
          todayStr={todayStr}
          selectedDate={selectedDate}
          onSelectDate={handleSelectCalendarDate}
          onAddTaskForDate={(dateStr) => {
            setEditingTask({ due_date: dateStr } as any);
            setIsModalOpen(true);
          }}
          onMaterializeRecurrence={handleMaterializeRecurrence}
          onImportCrossModule={handleImportCrossModule}
          onClose={closeCalendar}
        />
      )}

      {/* 🎯 1. BENTO ODAK MERKEZİ — GÜNÜN 3 ODAĞI (MIT) */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(16, 185, 129, 0.05))',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: '1 1 240px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Flame size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', rowGap: '4px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0, lineHeight: 1.3, color: 'var(--text-main)' }}>
                  Günün 3 Odak Görevi (MIT)
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: completedMitCount >= mitTargetCount ? 'var(--emerald-bg)' : 'rgba(245, 158, 11, 0.15)',
                    color: completedMitCount >= mitTargetCount ? 'var(--emerald)' : '#F59E0B',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {completedMitCount} / {mitTargetCount} Tamamlandı
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Anti-Overwhelm: Gün bitmeden kesinlikle tamamlanması gereken en kritik 3 iş.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Pomodoro Süre Seçici */}
            <div
              role="group"
              aria-label="Odak süresi seçimi"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)'
              }}
            >
              <Timer size={13} style={{ marginLeft: '5px', marginRight: '2px', color: 'var(--emerald)' }} />
              {ALLOWED_FOCUS_DURATIONS.map(mins => {
                const isSelected = focusDurationMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFocusDurationMinutes(mins)}
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '4px 7px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isSelected ? 'var(--emerald)' : 'transparent',
                      color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {mins}dk
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="btn-primary"
              style={{
                ...compactPrimaryBtnStyle,
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 800
              }}
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>Yeni Görev Ekle</span>
            </button>
          </div>
        </div>

        {/* MIT İlerleme Çubuğu */}
        <div style={{ width: '100%', height: '6px', background: 'var(--surface-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${mitPercent}%`,
              height: '100%',
              background: mitPercent === 100 ? '#10B981' : 'linear-gradient(90deg, #F59E0B, #10B981)',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {/* 3'lü MIT Spotları */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px'
          }}
        >
          {mitSlots.map(slotIdx => {
            const task = todayMitTasks[slotIdx];
            if (!task) {
              return (
                <div
                  key={slotIdx}
                  onClick={() => {
                    setEditingTask({ is_mit: 1, due_date: todayStr } as any);
                    setIsModalOpen(true);
                  }}
                  style={{
                    border: '1px dashed var(--border)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    minHeight: '42px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={15} />
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{slotIdx + 1}. Odak Görevini Belirle</span>
                </div>
              );
            }

            const isDone = task.status === 'completed';
            const isInFocus = task.status === 'in_progress' && Boolean(task.focus_started_at);
            const focusSummary = formatFocusDurationSummary(task.focus_logged_minutes);
            const cardCountdown = isInFocus ? computeFocusCountdown(task, nowMs) : null;
            const pillarCfg = PILLAR_CONFIGS[task.pillar] || PILLAR_CONFIGS.general;

            return (
              <div
                key={task.id}
                style={{
                  background: isInFocus
                    ? 'rgba(16, 185, 129, 0.1)'
                    : isDone
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'var(--surface)',
                  border: `1px solid ${
                    isInFocus
                      ? '#10B981'
                      : isDone
                        ? 'rgba(16, 185, 129, 0.3)'
                        : 'rgba(245, 158, 11, 0.35)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: isInFocus ? '0 0 0 1px rgba(16, 185, 129, 0.25)' : '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        width: '44px',
                        height: '44px',
                        margin: '-10px -6px -10px -10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: isDone ? '#10B981' : 'var(--text-muted)'
                      }}
                      aria-label={isDone ? 'Görevi geri al' : 'Görevi tamamla'}
                    >
                      {isDone ? <CheckCircle2 size={20} color="#10B981" /> : <Circle size={20} />}
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: isDone ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          wordBreak: 'break-word'
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: pillarCfg.bg, color: pillarCfg.color, fontWeight: 700 }}>
                          {pillarCfg.icon} {pillarCfg.label}
                        </span>
                        {cardCountdown && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--emerald-bg)', color: '#10B981', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            ⏱️ {cardCountdown.isFinished ? 'Süre Doldu!' : cardCountdown.formattedRemaining}
                          </span>
                        )}
                        {focusSummary && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {focusSummary}
                          </span>
                        )}
                        {task.subtasks_progress && task.subtasks_progress.total > 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {task.subtasks_progress.completed}/{task.subtasks_progress.total} Adım
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    {!isDone && (
                      <button
                        type="button"
                        disabled={focusSubmittingId !== null}
                        onClick={() => (isInFocus ? handlePauseFocus(task.id) : handleStartFocus(task.id, focusDurationMinutes))}
                        style={{
                          background: isInFocus ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                          border: isInFocus ? '1px solid rgba(16, 185, 129, 0.35)' : 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: isInFocus ? '#10B981' : 'var(--text-muted)',
                          minWidth: '44px',
                          minHeight: '44px',
                          margin: '-8px 0 0 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title={isInFocus ? 'Odak sayacını duraklat' : `${focusDurationMinutes} dk odak başlat`}
                        aria-label={isInFocus ? `${task.title} odağını duraklat` : `${task.title} için ${focusDurationMinutes} dk odak başlat`}
                      >
                        {isInFocus ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleMit(task.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#F59E0B',
                        minWidth: '44px',
                        minHeight: '44px',
                        margin: '-8px -8px 0 0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      title="Odak listesinden çıkar"
                      aria-label="Odak listesinden çıkar"
                    >
                      <Flame size={16} fill="#F59E0B" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1.5 AKTİF ODAK SEANSI BANNER'I (Pomodoro) */}
      {activeFocusTask && activeFocusCountdown && (
        <div
          className="card"
          role="region"
          aria-label="Aktif odak seansı zamanlayıcısı"
          style={{
            background: activeFocusCountdown.isFinished
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(245, 158, 11, 0.12))'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.08))',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 240px' }}>
              <div
                style={{
                  minWidth: '82px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.18)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10B981',
                  fontSize: '20px',
                  fontWeight: 900,
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.5px'
                }}
              >
                {activeFocusCountdown.formattedRemaining}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#10B981', letterSpacing: '0.4px' }}>
                  {activeFocusCountdown.isFinished
                    ? `🎉 ${activeFocusCountdown.plannedMinutes} DK ODAK SEANSI TAMAMLANDI!`
                    : `⏱️ ODAK SEANSI AKTİF (${activeFocusCountdown.plannedMinutes} DK POMODORO)`}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', wordBreak: 'break-word' }}>
                  {activeFocusTask.title}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {!activeFocusCountdown.isFinished && (
                <button
                  type="button"
                  disabled={focusSubmittingId !== null}
                  onClick={() => handlePauseFocus(activeFocusTask.id)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '7px 11px',
                    minHeight: '36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Pause size={13} />
                  <span>Duraklat</span>
                </button>
              )}

              <button
                type="button"
                disabled={focusSubmittingId !== null}
                onClick={() => handleCompleteFocus(activeFocusTask.id, false)}
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '7px 11px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#3B82F6',
                  cursor: 'pointer'
                }}
              >
                💾 Seansı Kaydet
              </button>

              <button
                type="button"
                disabled={focusSubmittingId !== null}
                onClick={() => handleCompleteFocus(activeFocusTask.id, true)}
                className="btn-primary"
                style={{
                  ...compactPrimaryBtnStyle,
                  fontSize: '11px',
                  padding: '7px 12px',
                  minHeight: '36px',
                  fontWeight: 800
                }}
              >
                ✅ Kaydet &amp; Görevi Tamamla
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '6px', background: 'var(--surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${activeFocusCountdown.progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981, #3B82F6)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* 2. GÖRÜNÜM SEÇİCİ SEKMELER & FİLTRELER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="tasks-view-toolbar">
          {/* 6 Akıllı Sekme — Mobilde tek satır kaydırılabilir hap barı, masaüstünde eksiksiz görünür */}
          <div
            className="tasks-view-tabs no-scrollbar"
            role="tablist"
            aria-label="Görev görünümleri"
          >
            {[
              { id: 'today', label: '☀️ Bugün', count: tabCounts.today, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
              { id: 'upcoming', label: '📅 Yaklaşan', count: tabCounts.upcoming, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
              { id: 'backlog', label: '📥 Backlog', count: tabCounts.backlog, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
              { id: 'recurring', label: '🔄 Rutinler', count: tabCounts.recurring, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' },
              { id: 'bridge', label: '🌉 Sistem Köprüsü', count: tabCounts.bridge, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
              { id: 'completed', label: '✅ Tamamlananlar', count: tabCounts.completed, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
            ].map((tab, tabIdx, allTabs) => {
              const isSelected = !selectedDate && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tasks-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className="tasks-view-tab"
                  onClick={(e) => {
                    setSelectedDate(null);
                    setActiveTab(tab.id as any);
                    e.currentTarget.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest', container: 'nearest' } as ScrollIntoViewOptions);
                  }}
                  onKeyDown={(e) => {
                    let nextIdx: number | null = null;
                    if (e.key === 'ArrowRight') nextIdx = (tabIdx + 1) % allTabs.length;
                    else if (e.key === 'ArrowLeft') nextIdx = (tabIdx - 1 + allTabs.length) % allTabs.length;
                    else if (e.key === 'Home') nextIdx = 0;
                    else if (e.key === 'End') nextIdx = allTabs.length - 1;
                    if (nextIdx === null) return;
                    e.preventDefault();
                    const nextTab = allTabs[nextIdx];
                    setSelectedDate(null);
                    setActiveTab(nextTab.id as any);
                    const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                    const targetBtn = buttons?.[nextIdx];
                    targetBtn?.focus();
                    targetBtn?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest', container: 'nearest' } as ScrollIntoViewOptions);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    border: `1px solid ${isSelected ? tab.color : 'var(--border)'}`,
                    background: isSelected ? tab.bg : 'var(--surface-subtle)',
                    color: isSelected ? tab.color : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: isSelected ? tab.color : 'var(--surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                      border: isSelected ? 'none' : '1px solid var(--border)',
                      fontWeight: 800
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kişisel / Aile Filtre Hapları */}
          <div className="tasks-scope-pills" role="group" aria-label="Görev kapsamı">
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'personal', label: '🔒 Kişisel' },
              { id: 'family', label: '👨‍👩‍👧 Aile' },
            ].map(f => {
              const isSelected = filterType === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    const nextType = f.id as 'all' | 'personal' | 'family';
                    setFilterType(nextType);
                    if (nextType === 'personal') setSelectedMember('all');
                  }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--emerald)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--emerald-bg)' : 'transparent',
                    color: isSelected ? 'var(--emerald)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pillar, Üye & Anlık Arama Çubuğu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Görev, not veya alt adım ara..."
              aria-label="Görevlerde ara"
              style={{
                width: '100%',
                padding: '7px 32px 7px 30px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Aramayı temizle"
                style={{
                  position: 'absolute',
                  right: '4px',
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div
            className="no-scrollbar"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px', width: '100%' }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <Filter size={12} /> Alan:
            </span>
            <button
              type="button"
              onClick={() => setSelectedPillar('all')}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                border: `1px solid ${selectedPillar === 'all' ? 'var(--blue)' : 'var(--border)'}`,
                background: selectedPillar === 'all' ? 'var(--blue-bg)' : 'var(--surface-subtle)',
                color: selectedPillar === 'all' ? 'var(--blue)' : 'var(--text-muted)',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              Tümü
            </button>
            {(Object.keys(PILLAR_CONFIGS) as TaskPillar[]).map(pKey => {
              const cfg = PILLAR_CONFIGS[pKey];
              const isSelected = selectedPillar === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setSelectedPillar(pKey)}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${isSelected ? cfg.color : 'var(--border)'}`,
                    background: isSelected ? cfg.bg : 'var(--surface-subtle)',
                    color: isSelected ? cfg.color : 'var(--text-muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          {members.length > 0 && filterType !== 'personal' && (selectedDate || activeTab !== 'bridge') && (
            <div
              className="no-scrollbar"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px', width: '100%' }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Users size={12} /> Üye:
              </span>
              <button
                type="button"
                onClick={() => setSelectedMember('all')}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${selectedMember === 'all' ? '#EC4899' : 'var(--border)'}`,
                  background: selectedMember === 'all' ? 'rgba(236, 72, 153, 0.12)' : 'var(--surface-subtle)',
                  color: selectedMember === 'all' ? '#EC4899' : 'var(--text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                Tüm Üyeler
              </button>
              {members.map(m => {
                const isSelected = selectedMember === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMember(m.id)}
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${isSelected ? '#EC4899' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(236, 72, 153, 0.12)' : 'var(--surface-subtle)',
                      color: isSelected ? '#EC4899' : 'var(--text-muted)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {m.avatar || '👤'} {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. İÇERİK LİSTESİ */}
      {/* A. SİSTEM KÖPRÜSÜ SEKMESİ */}
      {!selectedDate && activeTab === 'bridge' ? (
        <div
          role="tabpanel"
          aria-labelledby="tasks-tab-bridge"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            🌉 <strong>Modüller Arası Otomatik Görev Köprüsü:</strong> Yaklaşan faturalar, kredi kartı ekstreleri, araç muayene/kasko tarihleri ve dijital kasa evrakları otomatik tespit edilir. Tek tıkla yapılacak görevlerinize aktarabilirsiniz.
          </div>

          {scopedCrossModuleActions.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {crossModuleActions.length > 0 ? '🔍' : '🎉'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                {crossModuleActions.length > 0
                  ? 'Seçili Filtrelerde Sistem Uyarısı Yok'
                  : 'Tüm Sistem Hatırlatıcıları Güncel!'}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {crossModuleActions.length > 0
                  ? 'Farklı yaşam alanlarını görmek için kapsam veya alan filtresini sıfırlayabilirsiniz.'
                  : 'Acil bir fatura, araç muayenesi veya evrak bitişi bulunmuyor.'}
              </div>
              {crossModuleActions.length > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    marginTop: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Filtreleri Sıfırla
                </button>
              )}
            </div>
          ) : (
            scopedCrossModuleActions.map(action => (
              <div
                key={action.id}
                className="card"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '14px 16px 14px 18px',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                {renderLeftAccent(action.priority === 'critical' ? '#EF4444' : '#F59E0B')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: '1 1 220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: action.priority === 'critical' ? '#EF4444' : '#F59E0B' }}>
                      {action.priority === 'critical' ? '🚨 ACİL' : '⚠️ YAKLAŞAN'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {action.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {action.subtitle}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <Link
                    href={action.action_url}
                    className="btn-subtle"
                    style={{ fontSize: '11px', padding: '6px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    <span>Modüle Git</span>
                    <ArrowRight size={12} />
                  </Link>
                  <button
                    type="button"
                    disabled={importingActionId === action.id}
                    onClick={() => handleImportCrossModule(action)}
                    className="btn-primary"
                    style={{
                      ...compactPrimaryBtnStyle,
                      fontSize: '11px',
                      padding: '6px 12px',
                      fontWeight: 800,
                      opacity: importingActionId === action.id ? 0.6 : 1
                    }}
                  >
                    <span>{importingActionId === action.id ? '⏳ Aktarılıyor...' : '📥 Göreve Aktar'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* B. NORMAL GÖREV LİSTESİ */
        <div
          role={selectedDate ? 'region' : 'tabpanel'}
          aria-labelledby={!selectedDate ? `tasks-tab-${activeTab}` : undefined}
          aria-label={selectedDate ? 'Seçili gün görev listesi' : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {selectedDate && !calendarOpen && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                background: 'rgba(59, 130, 246, 0.08)',
                fontSize: '12px'
              }}
            >
              <span style={{ fontWeight: 800, color: '#3B82F6' }}>
                📅 Seçili Gün Filtresi: {formatTurkishDisplayDate(selectedDate, true)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask({ due_date: selectedDate } as any);
                    setIsModalOpen(true);
                  }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    background: 'var(--surface)',
                    color: '#3B82F6',
                    cursor: 'pointer'
                  }}
                >
                  + Bu Güne Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={12} />
                  <span>Temizle</span>
                </button>
              </div>
            </div>
          )}

          {overdueTasksInView.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                background: 'rgba(244, 63, 94, 0.08)',
                fontSize: '12px'
              }}
            >
              <span style={{ fontWeight: 800, color: 'var(--rose)' }}>
                🚨 {overdueTasksInView.length} gecikmiş görev bulunuyor
              </span>
              <button
                type="button"
                disabled={reschedulingId !== null}
                onClick={() => handleRescheduleAllOverdue(overdueTasksInView.map(t => t.id))}
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '5px 10px',
                  minHeight: '32px',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'var(--surface)',
                  color: '#F59E0B',
                  cursor: 'pointer',
                  opacity: reschedulingId !== null ? 0.6 : 1
                }}
              >
                {reschedulingId === 'all' ? '⏳ Aktarılıyor...' : '☀️ Tümünü Bugüne Al'}
              </button>
            </div>
          )}

          {loading && tasks.length === 0 ? (
            <div className="card" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>⏳</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Görevler yükleniyor...
              </div>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>{hasActiveFilters ? '🔍' : '🎯'}</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedDate
                  ? 'Bu tarihte görev bulunmuyor'
                  : hasActiveFilters
                    ? 'Arama veya filtrelerle eşleşen görev yok'
                    : activeTab === 'completed'
                      ? 'Henüz tamamlanan görev yok'
                      : 'Bu görünümde görev bulunmuyor'}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {hasActiveFilters
                  ? 'Farklı anahtar kelimeler deneyebilir veya aktif filtreleri temizleyebilirsiniz.'
                  : 'Yeni bir görev veya odak hedefi belirlemek için "+ Yeni Görev Ekle" butonunu kullanın.'}
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    marginTop: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Aramayı &amp; Filtreleri Temizle
                </button>
              )}
            </div>
          ) : (
            displayedTasks.map(task => {
              const isDone = task.status === 'completed';
              const isInFocus = task.status === 'in_progress' && Boolean(task.focus_started_at);
              const focusCountdown = isInFocus ? computeFocusCountdown(task, nowMs) : null;
              const focusSummary = formatFocusDurationSummary(task.focus_logged_minutes);
              const isExpanded = expandedTaskIds.has(task.id);
              const pillarCfg = PILLAR_CONFIGS[task.pillar] || PILLAR_CONFIGS.general;
              const priorityCfg = PRIORITY_CONFIGS[task.priority] || PRIORITY_CONFIGS.medium;

              const isOverdue = Boolean(task.due_date && task.due_date < todayStr && !isDone);
              const isToday = task.due_date === todayStr;
              const scheduleLabel = formatTaskScheduleLabel(task, todayStr);

              return (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '12px 16px 12px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderColor: isInFocus ? 'rgba(16, 185, 129, 0.55)' : undefined,
                    background: isInFocus
                      ? 'rgba(16, 185, 129, 0.05)'
                      : isDone
                        ? 'rgba(255, 255, 255, 0.01)'
                        : 'var(--surface)',
                    opacity: isDone ? 0.75 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {renderLeftAccent(isDone ? 'var(--border)' : isInFocus ? '#10B981' : pillarCfg.color)}
                  {/* Üst Kısım: Checkbox + Başlık + Aksiyonlar */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: '200px', flex: '1 1 200px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          width: '44px',
                          height: '44px',
                          margin: '-9px -4px -9px -9px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isDone ? '#10B981' : 'var(--text-muted)',
                          flexShrink: 0
                        }}
                        aria-label={isDone ? 'Görevi geri al' : 'Görevi tamamla'}
                      >
                        {isDone ? <CheckCircle2 size={22} color="#10B981" /> : <Circle size={22} />}
                      </button>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: isDone ? 'var(--text-muted)' : 'var(--text-main)',
                            textDecoration: isDone ? 'line-through' : 'none',
                            lineHeight: 1.4,
                            wordBreak: 'break-word'
                          }}
                        >
                          {task.title}
                        </div>

                        {task.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                            {task.description}
                          </div>
                        )}

                        {/* Rozet Şeridi */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {/* Pillar */}
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: pillarCfg.bg, color: pillarCfg.color, fontWeight: 700 }}>
                            {pillarCfg.icon} {pillarCfg.label}
                          </span>

                          {/* Öncelik */}
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: priorityCfg.bg, color: priorityCfg.color, fontWeight: 700 }}>
                            {priorityCfg.badge} {priorityCfg.label}
                          </span>

                          {/* MIT Rozeti */}
                          {task.is_mit === 1 && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Flame size={11} fill="#F59E0B" /> MIT Odak
                            </span>
                          )}

                          {/* Aktif Odak / Toplam Pomodoro Rozeti */}
                          {focusCountdown && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--emerald-bg)', color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px', fontVariantNumeric: 'tabular-nums' }}>
                              <Timer size={10} /> {focusCountdown.isFinished ? 'Süre Doldu!' : `Odakta • ${focusCountdown.formattedRemaining}`}
                            </span>
                          )}
                          {!focusCountdown && task.status === 'in_progress' && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.14)', color: '#F59E0B', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Timer size={10} /> Devam Ediyor
                            </span>
                          )}
                          {focusSummary && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Timer size={10} /> {focusSummary}
                            </span>
                          )}

                          {/* Vade Tarihi & Saat */}
                          {scheduleLabel && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isOverdue ? 'var(--rose-bg)' : isToday ? 'var(--amber-bg)' : 'var(--surface-subtle)',
                                color: isOverdue ? 'var(--rose)' : isToday ? 'var(--amber)' : 'var(--text-muted)',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              {task.due_date ? <Calendar size={10} /> : <Clock size={10} />}
                              {scheduleLabel}
                            </span>
                          )}

                          {/* Tekrarlama */}
                          {task.recurrence && task.recurrence !== 'none' && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Repeat size={10} /> {task.recurrence === 'daily' ? 'Günlük' : task.recurrence === 'weekly' ? 'Haftalık' : 'Aylık'}
                            </span>
                          )}

                          {/* Geciken görevlere hızlı erteleme */}
                          {isOverdue && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                disabled={reschedulingId !== null}
                                onClick={() => handleRescheduleTask(task.id, todayStr)}
                                aria-label={`${task.title} görevini bugüne al`}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  minHeight: '26px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  color: '#F59E0B',
                                  cursor: 'pointer',
                                  opacity: reschedulingId === task.id ? 0.6 : 1
                                }}
                              >
                                ☀️ Bugüne Al
                              </button>
                              <button
                                type="button"
                                disabled={reschedulingId !== null}
                                onClick={() => handleRescheduleTask(task.id, shiftTurkeyDate(todayStr, 1))}
                                aria-label={`${task.title} görevini yarına ertele`}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  minHeight: '26px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(59, 130, 246, 0.35)',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: '#3B82F6',
                                  cursor: 'pointer',
                                  opacity: reschedulingId === task.id ? 0.6 : 1
                                }}
                              >
                                📅 Yarına Ertele
                              </button>
                            </div>
                          )}

                          {/* Aile Paylaşımı / Üye */}
                          {task.is_family_shared === 1 && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Users size={10} /> {task.assigned_member_name ? `${task.assigned_member_avatar || '👤'} ${task.assigned_member_name}` : 'Aile'}
                            </span>
                          )}

                          {/* Alt Görev Sayacı Rozeti */}
                          {task.subtasks_progress && task.subtasks_progress.total > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(task.id)}
                              style={{
                                border: '1px solid var(--border)',
                                background: 'var(--surface-subtle)',
                                color: task.subtasks_progress.percent === 100 ? '#10B981' : 'var(--text-main)',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <CheckSquare size={10} />
                              <span>{task.subtasks_progress.completed}/{task.subtasks_progress.total} Adım</span>
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}

                          {/* Tamamlanmış Köprü Görevinde Kaynak Modüle Geri-Yazım Kısayolu */}
                          {isDone && (() => {
                            const followUp = resolveCrossModuleFollowUp(task);
                            if (!followUp) return null;
                            return (
                              <Link
                                href={followUp.href}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(236, 72, 153, 0.35)',
                                  background: 'rgba(236, 72, 153, 0.1)',
                                  color: '#EC4899',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span>{followUp.label}</span>
                                <ArrowRight size={10} />
                              </Link>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Sağ Aksiyon Butonları */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
                      {/* Odaklan / Duraklat (Pomodoro) Butonu */}
                      {!isDone && (
                        <button
                          type="button"
                          disabled={focusSubmittingId !== null}
                          onClick={() => (isInFocus ? handlePauseFocus(task.id) : handleStartFocus(task.id, focusDurationMinutes))}
                          style={{
                            ...actionIconBtnStyle(false, isInFocus ? '#10B981' : 'var(--text-muted)'),
                            background: isInFocus ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-subtle)',
                            border: `1px solid ${isInFocus ? 'rgba(16, 185, 129, 0.45)' : 'var(--border)'}`
                          }}
                          title={isInFocus ? 'Odak sayacını duraklat' : `Odaklan (${focusDurationMinutes} dk)`}
                          aria-label={isInFocus ? `${task.title} odağını duraklat` : `${task.title} için odak başlat`}
                        >
                          {isInFocus ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                      )}

                      {/* MIT Toggle Butonu */}
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => handleToggleMit(task.id)}
                          style={actionIconBtnStyle(task.is_mit === 1, task.is_mit === 1 ? '#F59E0B' : 'var(--text-muted)')}
                          title={task.is_mit === 1 ? 'Odak listesinden çıkar' : 'Günün odağına (MIT) al'}
                          aria-label={task.is_mit === 1 ? 'Odak listesinden çıkar' : 'Günün odağına al'}
                        >
                          <Flame size={15} fill={task.is_mit === 1 ? '#F59E0B' : 'none'} />
                        </button>
                      )}

                      {/* Düzenle */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(task);
                          setIsModalOpen(true);
                        }}
                        style={actionIconBtnStyle(false, 'var(--text-muted)')}
                        title="Görevi Düzenle"
                        aria-label="Görevi Düzenle"
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Sil */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        style={actionIconBtnStyle(false, 'var(--rose)')}
                        title="Görevi Sil"
                        aria-label="Görevi Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Açılır Alt Görevler (Micro-Checklist) */}
                  {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '10px 12px',
                        background: 'var(--surface-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>
                          ALT ADIMLAR ({task.subtasks_progress?.completed}/{task.subtasks_progress?.total})
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 700 }}>
                          %{task.subtasks_progress?.percent} Tamamlandı
                        </span>
                      </div>

                      {task.subtasks.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleToggleSubtask(task.id, st.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: st.is_completed ? 'var(--text-muted)' : 'var(--text-main)',
                            textDecoration: st.is_completed ? 'line-through' : 'none',
                            padding: '6px 0',
                            minHeight: '36px',
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left'
                          }}
                        >
                          {st.is_completed ? (
                            <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />
                          ) : (
                            <Circle size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          )}
                          <span>{st.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Görev Ekleme / Düzenleme Modalı */}
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSuccess={(msg, data) => {
          showToast(msg || 'Görev kaydedildi.');
          if (data?.task_id && data?.follow_up_action) {
            captureFollowUp(data.task_id, data.follow_up_action);
          }
          syncTasks();
        }}
        members={members}
        initialData={editingTask}
      />
    </div>
  );
}
