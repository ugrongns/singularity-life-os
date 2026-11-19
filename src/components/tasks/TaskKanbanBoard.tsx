'use client';

import React, { useState } from 'react';
import { Play, Pause, CheckCircle2, Flame, CalendarClock, Plus } from 'lucide-react';
import {
  TaskItem,
  TaskPillar,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS,
  computeFocusCountdown,
  formatTaskScheduleLabel,
  sortTasksForDisplay
} from '@/lib/tasks-engine';
import { shiftTurkeyDate } from '@/lib/date-utils';

export type KanbanColumnId = 'backlog' | 'todo' | 'in_progress' | 'completed';

interface TaskKanbanBoardProps {
  tasks: TaskItem[];
  todayStr: string;
  nowMs: number;
  focusDurationMinutes: number;
  focusSubmittingId: string | null;
  reschedulingId: string | null;
  onToggleComplete: (taskId: string, options?: { dueDate?: string | null }) => Promise<void>;
  onStartFocus: (taskId: string, durationMinutes?: number, options?: { reopenIfCompleted?: boolean }) => Promise<void>;
  onPauseFocus: (taskId: string, options?: { dueDate?: string | null }) => Promise<void>;
  onRescheduleTask: (taskId: string, dueDate: string) => Promise<void>;
  onQuickCreateInColumn: (title: string, col: KanbanColumnId) => Promise<void>;
  onEditTask: (task: TaskItem) => void;
}

const COLUMNS: Array<{
  id: KanbanColumnId;
  title: string;
  icon: string;
  color: string;
  bg: string;
  emptyText: string;
}> = [
  {
    id: 'backlog',
    title: 'Backlog (Tarihsiz)',
    icon: '📥',
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.1)',
    emptyText: 'Tarihsiz bekleyen görev yok'
  },
  {
    id: 'todo',
    title: 'Yapılacak (Planlı)',
    icon: '📋',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.1)',
    emptyText: 'Planlı yapılacak görev yok'
  },
  {
    id: 'in_progress',
    title: 'Sürüyor (Odak)',
    icon: '🔥',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.1)',
    emptyText: 'Şu an odakta görev yok'
  },
  {
    id: 'completed',
    title: 'Tamamlandı',
    icon: '✅',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    emptyText: 'Henüz tamamlanan görev yok'
  }
];

export default function TaskKanbanBoard({
  tasks,
  todayStr,
  nowMs,
  focusDurationMinutes,
  focusSubmittingId,
  reschedulingId,
  onToggleComplete,
  onStartFocus,
  onPauseFocus,
  onRescheduleTask,
  onQuickCreateInColumn,
  onEditTask
}: TaskKanbanBoardProps) {
  const [mobileColumn, setMobileColumn] = useState<KanbanColumnId>('todo');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanColumnId | null>(null);
  const [columnInputs, setColumnInputs] = useState<Record<KanbanColumnId, string>>({
    backlog: '',
    todo: '',
    in_progress: '',
    completed: ''
  });
  const [submittingCol, setSubmittingCol] = useState<KanbanColumnId | null>(null);

  const grouped: Record<KanbanColumnId, TaskItem[]> = {
    backlog: sortTasksForDisplay(
      tasks.filter(t => t.status === 'pending' && (!t.due_date || t.due_date.trim() === '')),
      'backlog'
    ),
    todo: sortTasksForDisplay(
      tasks.filter(t => t.status === 'pending' && Boolean(t.due_date && t.due_date.trim() !== '')),
      'today'
    ),
    in_progress: sortTasksForDisplay(
      tasks.filter(t => t.status === 'in_progress'),
      'today'
    ),
    completed: sortTasksForDisplay(
      tasks.filter(t => t.status === 'completed'),
      'completed'
    ).slice(0, 20)
  };

  const tomorrowStr = shiftTurkeyDate(todayStr, 1);

  const getTaskColumn = (task: TaskItem): KanbanColumnId => {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'in_progress') return 'in_progress';
    return task.due_date && task.due_date.trim() !== '' ? 'todo' : 'backlog';
  };

  const moveTaskToColumn = async (task: TaskItem, targetCol: KanbanColumnId) => {
    const sourceCol = getTaskColumn(task);
    if (sourceCol === targetCol) return;

    if (targetCol === 'completed') {
      await onToggleComplete(task.id);
      return;
    }
    if (targetCol === 'in_progress') {
      await onStartFocus(task.id, focusDurationMinutes, {
        reopenIfCompleted: task.status === 'completed'
      });
      return;
    }
    if (targetCol === 'todo') {
      const targetDueDate = task.due_date && task.due_date.trim() !== '' ? undefined : todayStr;
      if (task.status === 'completed') {
        await onToggleComplete(task.id, targetDueDate !== undefined ? { dueDate: targetDueDate } : undefined);
        return;
      }
      if (task.status === 'in_progress') {
        await onPauseFocus(task.id, targetDueDate !== undefined ? { dueDate: targetDueDate } : undefined);
        return;
      }
      if (!task.due_date || task.due_date.trim() === '') {
        await onRescheduleTask(task.id, todayStr);
      }
      return;
    }
    if (targetCol === 'backlog') {
      if (task.status === 'completed') {
        await onToggleComplete(task.id, task.due_date ? { dueDate: null } : undefined);
        return;
      }
      if (task.status === 'in_progress') {
        await onPauseFocus(task.id, task.due_date ? { dueDate: null } : undefined);
        return;
      }
      if (task.due_date) {
        await onRescheduleTask(task.id, '');
      }
    }
  };

  const handleColumnAdd = async (col: KanbanColumnId) => {
    const val = (columnInputs[col] || '').trim();
    if (!val || submittingCol) return;
    setSubmittingCol(col);
    try {
      await onQuickCreateInColumn(val, col);
      setColumnInputs(prev => ({ ...prev, [col]: '' }));
    } finally {
      setSubmittingCol(null);
    }
  };

  const renderColumn = (col: (typeof COLUMNS)[number]) => {
    const colTasks = grouped[col.id];
    const isDropTarget = dragOverCol === col.id;

    return (
      <div
        key={col.id}
        onDragOver={e => {
          e.preventDefault();
          if (dragOverCol !== col.id) setDragOverCol(col.id);
        }}
        onDragLeave={() => {
          if (dragOverCol === col.id) setDragOverCol(null);
        }}
        onDrop={async e => {
          e.preventDefault();
          setDragOverCol(null);
          const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
          setDraggedTaskId(null);
          if (!taskId) return;
          const targetTask = tasks.find(t => t.id === taskId);
          if (targetTask) await moveTaskToColumn(targetTask, col.id);
        }}
        style={{
          background: isDropTarget ? col.bg : 'var(--surface-subtle)',
          border: `1px solid ${isDropTarget ? col.color : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '340px',
          transition: 'border-color 0.15s ease, background 0.15s ease'
        }}
      >
        {/* Sütun Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>{col.icon}</span>
            <span>{col.title}</span>
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              background: col.bg,
              color: col.color
            }}
          >
            {colTasks.length}
          </span>
        </div>

        {/* Sütun İçi Hızlı Kart Ekleme */}
        {col.id !== 'completed' && (
          <form
            onSubmit={e => {
              e.preventDefault();
              void handleColumnAdd(col.id);
            }}
            style={{ display: 'flex', gap: '6px' }}
          >
            <input
              type="text"
              value={columnInputs[col.id]}
              onChange={e => setColumnInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
              placeholder="+ Hızlı kart ekle..."
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 9px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontWeight: 600
              }}
            />
            <button
              type="submit"
              disabled={submittingCol === col.id || !columnInputs[col.id].trim()}
              aria-label={`${col.title} sütununa ekle`}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: col.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Plus size={14} />
            </button>
          </form>
        )}

        {/* Kartlar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {colTasks.length === 0 ? (
            <div style={{ padding: '24px 10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              {col.emptyText}
            </div>
          ) : (
            colTasks.map(task => {
              const pillarCfg = PILLAR_CONFIGS[(task.pillar as TaskPillar) || 'general'] || PILLAR_CONFIGS.general;
              const priorityCfg = PRIORITY_CONFIGS[task.priority] || PRIORITY_CONFIGS.medium;
              const isDone = task.status === 'completed';
              const isInFocus = task.status === 'in_progress' && Boolean(task.focus_started_at);
              const focusCountdown = isInFocus ? computeFocusCountdown(task, nowMs) : null;
              const scheduleLabel = formatTaskScheduleLabel(task, todayStr);

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => {
                    setDraggedTaskId(task.id);
                    e.dataTransfer.setData('text/plain', task.id);
                  }}
                  onDragEnd={() => {
                    setDraggedTaskId(null);
                    setDragOverCol(null);
                  }}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isInFocus ? 'rgba(16, 185, 129, 0.5)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${isDone ? 'var(--border)' : pillarCfg.color}`,
                    borderRadius: '10px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    cursor: 'grab',
                    opacity: isDone ? 0.72 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        lineHeight: 1.35,
                        flex: 1
                      }}
                    >
                      {task.is_mit === 1 && !isDone && <Flame size={12} color="#F59E0B" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />}
                      {task.title}
                    </button>
                    <span style={{ fontSize: '10px' }} title={priorityCfg.label}>{priorityCfg.badge}</span>
                  </div>

                  {/* Rozetler */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: pillarCfg.color, background: pillarCfg.bg, padding: '2px 6px', borderRadius: '5px' }}>
                      {pillarCfg.icon} {pillarCfg.label}
                    </span>
                    {scheduleLabel && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '5px' }}>
                        {scheduleLabel}
                      </span>
                    )}
                    {focusCountdown && (
                      <span style={{ fontSize: '10px', fontWeight: 900, color: '#10B981', background: 'rgba(16, 185, 129, 0.14)', padding: '2px 6px', borderRadius: '5px', fontVariantNumeric: 'tabular-nums' }}>
                        ⏱️ {focusCountdown.formattedRemaining}
                      </span>
                    )}
                  </div>

                  {/* Hızlı Aksiyon Butonları (Mobil & Masaüstü Tek Tık Geçiş) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingTop: '2px' }}>
                    {!isDone && (
                      <button
                        type="button"
                        disabled={focusSubmittingId !== null}
                        onClick={() => (isInFocus ? onPauseFocus(task.id) : onStartFocus(task.id, focusDurationMinutes))}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          minHeight: '30px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: isInFocus ? 'rgba(245, 158, 11, 0.14)' : 'var(--surface-subtle)',
                          color: isInFocus ? '#F59E0B' : 'var(--text-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {isInFocus ? <Pause size={11} /> : <Play size={11} />}
                        <span>{isInFocus ? 'Duraklat' : 'Odaklan'}</span>
                      </button>
                    )}

                    {!isDone && task.due_date !== tomorrowStr && (
                      <button
                        type="button"
                        disabled={reschedulingId !== null}
                        onClick={() => onRescheduleTask(task.id, tomorrowStr)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          minHeight: '30px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-subtle)',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                        title="Yarına ertele"
                      >
                        <CalendarClock size={11} />
                        <span>Yarına</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleComplete(task.id)}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        minHeight: '30px',
                        borderRadius: '6px',
                        border: `1px solid ${isDone ? 'var(--border)' : 'rgba(16, 185, 129, 0.4)'}`,
                        background: isDone ? 'var(--surface-subtle)' : 'rgba(16, 185, 129, 0.12)',
                        color: isDone ? 'var(--text-muted)' : '#10B981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        marginLeft: 'auto'
                      }}
                    >
                      <CheckCircle2 size={11} />
                      <span>{isDone ? 'Geri Al' : 'Bitir'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Mobil Sütun Seçici (<768px görünür) */}
      <div className="kanban-mobile-tabs no-scrollbar" style={{ display: 'none', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {COLUMNS.map(col => {
          const isSelected = mobileColumn === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setMobileColumn(col.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '999px',
                border: `1px solid ${isSelected ? col.color : 'var(--border)'}`,
                background: isSelected ? col.bg : 'var(--surface-subtle)',
                color: isSelected ? col.color : 'var(--text-main)',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer'
              }}
            >
              {col.icon} {col.title} ({grouped[col.id].length})
            </button>
          );
        })}
      </div>

      {/* Masaüstü 4 Sütun Grid, Mobilde Seçili Sütun */}
      <div className="kanban-grid">
        {COLUMNS.map(col => (
          <div key={col.id} className={`kanban-col-wrapper ${mobileColumn === col.id ? 'is-mobile-active' : ''}`}>
            {renderColumn(col)}
          </div>
        ))}
      </div>

      <style jsx>{`
        .kanban-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 1120px) {
          .kanban-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 767px) {
          .kanban-mobile-tabs {
            display: flex !important;
          }
          .kanban-grid {
            grid-template-columns: 1fr;
          }
          .kanban-col-wrapper {
            display: none;
          }
          .kanban-col-wrapper.is-mobile-active {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
