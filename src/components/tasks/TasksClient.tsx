'use client';

import React, { useState, useEffect } from 'react';
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
  Tag,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Edit2,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Inbox,
  Filter,
  CheckSquare,
  X
} from 'lucide-react';
import {
  TaskItem,
  TaskPillar,
  TaskPriority,
  CrossModuleAction,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS,
  filterTasksByView,
  filterTasksByDate
} from '@/lib/tasks-engine';
import { getTodayTurkeyDate, formatTurkishDisplayDate } from '@/lib/date-utils';
import AddTaskModal from '@/components/modals/AddTaskModal';
import TaskCalendarPanel from '@/components/tasks/TaskCalendarPanel';

interface TasksClientProps {
  initialData?: any;
  isCalendarOpen?: boolean;
  onCloseCalendar?: () => void;
}

export default function TasksClient({
  initialData,
  isCalendarOpen,
  onCloseCalendar
}: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialData?.tasks || []);
  const [mitSummary, setMitSummary] = useState(initialData?.mitSummary || { activeMitCount: 0, completedMitCount: 0, maxMit: 3 });
  const [crossModuleActions, setCrossModuleActions] = useState<CrossModuleAction[]>(initialData?.crossModuleActions || []);
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar: string }>>(initialData?.members || []);

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'backlog' | 'recurring' | 'bridge' | 'completed'>('today');
  const [filterType, setFilterType] = useState<'all' | 'personal' | 'family'>('all');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [internalCalendarOpen, setInternalCalendarOpen] = useState(false);

  const calendarOpen = isCalendarOpen ?? internalCalendarOpen;
  const closeCalendar = onCloseCalendar ?? (() => setInternalCalendarOpen(false));

  const [loading, setLoading] = useState(!initialData);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Açık alt görev kutuları
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (json.success && json.data) {
        setTasks(json.data.tasks || []);
        setMitSummary(json.data.mitSummary || { activeMitCount: 0, completedMitCount: 0, maxMit: 3 });
        setCrossModuleActions(json.data.crossModuleActions || []);
        setMembers(json.data.members || []);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    } finally {
      setLoading(false);
    }
  };

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
            completed_at: isDone ? null : new Date().toISOString()
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
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        fetchTasks();
      } else {
        showToast(json.error || 'İşlem başarısız.');
        fetchTasks();
      }
    } catch {
      fetchTasks();
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
        fetchTasks();
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
            ? { status: 'completed' as const, completed_at: new Date().toISOString() }
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
        fetchTasks();
        return;
      }
      if (json.data?.transition && json.data.transition !== 'none') {
        if (json.message) showToast(json.message);
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        fetchTasks();
      }
    } catch {
      fetchTasks();
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
        fetchTasks();
      }
    } catch {
      showToast('Görev silinirken hata oluştu.');
    }
  };

  const handleImportCrossModule = async (action: CrossModuleAction) => {
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
          source_ref_id: action.source_ref_id
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('✅ Görev listesine aktarıldı!');
        fetchTasks();
      }
    } catch {
      showToast('Aktarım sırasında hata oluştu.');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todayStr = getTodayTurkeyDate();

  // MIT Görevleri (Günün 3 Odağı)
  const todayMitTasks = tasks.filter(t => t.is_mit === 1 && (!t.due_date || t.due_date === todayStr));
  const mitPercent = Math.min(100, Math.round((mitSummary.completedMitCount / Math.max(1, (mitSummary.activeMitCount + mitSummary.completedMitCount))) * 100)) || 0;

  // Görünüm Listesi Filtreleme (Tek kaynak: tasks-engine)
  const applyScopeFilters = (list: TaskItem[]) => {
    let result = list;
    if (filterType === 'personal') {
      result = result.filter(t => t.is_family_shared === 0);
    } else if (filterType === 'family') {
      result = result.filter(t => t.is_family_shared === 1);
    }
    if (selectedPillar !== 'all') {
      result = result.filter(t => t.pillar === selectedPillar);
    }
    if (selectedMember !== 'all') {
      result = result.filter(t => t.assigned_member_id === selectedMember);
    }
    return result;
  };

  const scopedTasks = applyScopeFilters(tasks);
  const displayedTasks = selectedDate
    ? applyScopeFilters(filterTasksByDate(tasks, selectedDate))
    : applyScopeFilters(activeTab === 'bridge' ? tasks : filterTasksByView(tasks, activeTab, todayStr));

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
    borderRadius: '6px',
    width: '30px',
    height: '30px',
    display: 'flex',
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

      {/* 📅 AÇILIR/KAPANIR AYLIK GÖREV TAKVİMİ (Varsayılan kapalı) */}
      {calendarOpen && (
        <TaskCalendarPanel
          tasks={scopedTasks}
          crossModuleActions={crossModuleActions}
          todayStr={todayStr}
          selectedDate={selectedDate}
          onSelectDate={handleSelectCalendarDate}
          onAddTaskForDate={(dateStr) => {
            setEditingTask({ due_date: dateStr } as any);
            setIsModalOpen(true);
          }}
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
                    background: mitSummary.completedMitCount === 3 ? 'var(--emerald-bg)' : 'rgba(245, 158, 11, 0.15)',
                    color: mitSummary.completedMitCount === 3 ? 'var(--emerald)' : '#F59E0B',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {mitSummary.completedMitCount} / {Math.min(3, Math.max(todayMitTasks.length, 3))} Tamamlandı
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Anti-Overwhelm: Gün bitmeden kesinlikle tamamlanması gereken en kritik 3 iş.
              </div>
            </div>
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
          {[0, 1, 2].map(slotIdx => {
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
            const pillarCfg = PILLAR_CONFIGS[task.pillar] || PILLAR_CONFIGS.general;

            return (
              <div
                key={task.id}
                style={{
                  background: isDone ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface)',
                  border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: isDone ? '#10B981' : 'var(--text-muted)' }}
                      aria-label="Görevi tamamla"
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
                        {task.subtasks_progress && task.subtasks_progress.total > 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {task.subtasks_progress.completed}/{task.subtasks_progress.total} Adım
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMit(task.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#F59E0B', padding: '2px' }}
                    title="Odak listesinden çıkar"
                  >
                    <Flame size={16} fill="#F59E0B" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. GÖRÜNÜM SEÇİCİ SEKMELER & FİLTRELER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* 6 Akıllı Sekme — Mobilde tek satır kaydırılabilir hap barı */}
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: '6px',
              overflowX: 'auto',
              flex: '1 1 540px',
              minWidth: 0,
              maxWidth: '100%',
              paddingBottom: '2px'
            }}
          >
            {[
              { id: 'today', label: '☀️ Bugün', count: filterTasksByView(tasks, 'today', todayStr).length, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
              { id: 'upcoming', label: '📅 Yaklaşan', count: filterTasksByView(tasks, 'upcoming', todayStr).length, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
              { id: 'backlog', label: '📥 Backlog', count: filterTasksByView(tasks, 'backlog', todayStr).length, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
              { id: 'recurring', label: '🔄 Rutinler', count: filterTasksByView(tasks, 'recurring', todayStr).length, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' },
              { id: 'bridge', label: '🌉 Sistem Köprüsü', count: crossModuleActions.length, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
              { id: 'completed', label: '✅ Tamamlananlar', count: filterTasksByView(tasks, 'completed', todayStr).length, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
            ].map(tab => {
              const isSelected = !selectedDate && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(null);
                    setActiveTab(tab.id as any);
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
                    transition: 'all 0.15s ease'
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
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
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
                  onClick={() => setFilterType(f.id as any)}
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

        {/* Pillar & Üye Filtre Çubuğu */}
        {(selectedDate || activeTab !== 'bridge') && (
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
        )}
      </div>

      {/* 3. İÇERİK LİSTESİ */}
      {/* A. SİSTEM KÖPRÜSÜ SEKMESİ */}
      {!selectedDate && activeTab === 'bridge' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            🌉 <strong>Modüller Arası Otomatik Görev Köprüsü:</strong> Yaklaşan faturalar, kredi kartı ekstreleri, araç muayene/kasko tarihleri ve dijital kasa evrakları otomatik tespit edilir. Tek tıkla yapılacak görevlerinize aktarabilirsiniz.
          </div>

          {crossModuleActions.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                Tüm Sistem Hatırlatıcıları Güncel!
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Acil bir fatura, araç muayenesi veya evrak bitişi bulunmuyor.
              </div>
            </div>
          ) : (
            crossModuleActions.map(action => (
              <div
                key={action.id}
                className="card"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '14px 16px 14px 18px',
                  display: 'flex',
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
                    onClick={() => handleImportCrossModule(action)}
                    className="btn-primary"
                    style={{
                      ...compactPrimaryBtnStyle,
                      fontSize: '11px',
                      padding: '6px 12px',
                      fontWeight: 800
                    }}
                  >
                    <span>📥 Göreve Aktar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* B. NORMAL GÖREV LİSTESİ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

          {displayedTasks.length === 0 ? (
            <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedDate
                  ? 'Bu tarihte görev bulunmuyor'
                  : activeTab === 'completed'
                    ? 'Henüz tamamlanan görev yok'
                    : 'Bu görünümde görev bulunmuyor'}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Yeni bir görev veya odak hedefi belirlemek için "+ Yeni Görev Ekle" butonunu kullanın.
              </div>
            </div>
          ) : (
            displayedTasks.map(task => {
              const isDone = task.status === 'completed';
              const isExpanded = expandedTaskIds.has(task.id);
              const pillarCfg = PILLAR_CONFIGS[task.pillar] || PILLAR_CONFIGS.general;
              const priorityCfg = PRIORITY_CONFIGS[task.priority] || PRIORITY_CONFIGS.medium;

              const isOverdue = task.due_date && task.due_date < todayStr && !isDone;
              const isToday = task.due_date === todayStr;

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
                    background: isDone ? 'rgba(255, 255, 255, 0.01)' : 'var(--surface)',
                    opacity: isDone ? 0.75 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {renderLeftAccent(isDone ? 'var(--border)' : pillarCfg.color)}
                  {/* Üst Kısım: Checkbox + Başlık + Aksiyonlar */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          marginTop: '2px',
                          color: isDone ? '#10B981' : 'var(--text-muted)',
                          flexShrink: 0
                        }}
                        aria-label="Görevi tamamla"
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

                          {/* Vade Tarihi */}
                          {task.due_date && (
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
                              <Calendar size={10} />
                              {isOverdue ? `🚨 ${task.due_date} (Gecikti)` : isToday ? `Bugün ${task.due_time || ''}` : task.due_date}
                            </span>
                          )}

                          {/* Tekrarlama */}
                          {task.recurrence && task.recurrence !== 'none' && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Repeat size={10} /> {task.recurrence === 'daily' ? 'Günlük' : task.recurrence === 'weekly' ? 'Haftalık' : 'Aylık'}
                            </span>
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
                        </div>
                      </div>
                    </div>

                    {/* Sağ Aksiyon Butonları */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {/* MIT Toggle Butonu */}
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => handleToggleMit(task.id)}
                          style={actionIconBtnStyle(task.is_mit === 1, task.is_mit === 1 ? '#F59E0B' : 'var(--text-muted)')}
                          title={task.is_mit === 1 ? 'Odak listesinden çıkar' : 'Günün odağına (MIT) al'}
                        >
                          <Flame size={14} fill={task.is_mit === 1 ? '#F59E0B' : 'none'} />
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
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Sil */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        style={actionIconBtnStyle(false, 'var(--rose)')}
                        title="Görevi Sil"
                      >
                        <Trash2 size={13} />
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
                        gap: '6px'
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
                        <div
                          key={st.id}
                          onClick={() => handleToggleSubtask(task.id, st.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: st.is_completed ? 'var(--text-muted)' : 'var(--text-main)',
                            textDecoration: st.is_completed ? 'line-through' : 'none',
                            padding: '3px 0'
                          }}
                        >
                          {st.is_completed ? (
                            <CheckCircle2 size={16} color="#10B981" />
                          ) : (
                            <Circle size={16} color="var(--text-muted)" />
                          )}
                          <span>{st.title}</span>
                        </div>
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
        onSuccess={(msg) => {
          showToast(msg || 'Görev kaydedildi.');
          fetchTasks();
        }}
        members={members}
        initialData={editingTask}
      />
    </div>
  );
}
