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
  CheckSquare
} from 'lucide-react';
import {
  TaskItem,
  TaskPillar,
  TaskPriority,
  CrossModuleAction,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS
} from '@/lib/tasks-engine';
import AddTaskModal from '@/components/modals/AddTaskModal';

interface TasksClientProps {
  initialData?: any;
}

export default function TasksClient({ initialData }: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialData?.tasks || []);
  const [mitSummary, setMitSummary] = useState(initialData?.mitSummary || { activeMitCount: 0, completedMitCount: 0, maxMit: 3 });
  const [crossModuleActions, setCrossModuleActions] = useState<CrossModuleAction[]>(initialData?.crossModuleActions || []);
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar: string }>>(initialData?.members || []);

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'backlog' | 'recurring' | 'bridge' | 'completed'>('today');
  const [filterType, setFilterType] = useState<'all' | 'personal' | 'family'>('all');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');

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
          return {
            ...t,
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

      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_subtask', task_id: taskId, subtask_id: subtaskId })
      });
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

  const todayStr = new Date().toISOString().slice(0, 10);

  // MIT Görevleri (Günün 3 Odağı)
  const todayMitTasks = tasks.filter(t => t.is_mit === 1 && (!t.due_date || t.due_date === todayStr));
  const mitPercent = Math.min(100, Math.round((mitSummary.completedMitCount / Math.max(1, (mitSummary.activeMitCount + mitSummary.completedMitCount))) * 100)) || 0;

  // Görünüm Listesi Filtreleme
  let displayedTasks = tasks;
  switch (activeTab) {
    case 'today':
      displayedTasks = tasks.filter(t => {
        if (t.status === 'completed') {
          return t.due_date === todayStr || (t.completed_at && t.completed_at.slice(0, 10) === todayStr);
        }
        return t.due_date === todayStr || (t.due_date && t.due_date < todayStr) || t.is_mit === 1;
      });
      break;
    case 'upcoming':
      displayedTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date > todayStr);
      break;
    case 'backlog':
      displayedTasks = tasks.filter(t => t.status !== 'completed' && (!t.due_date || t.due_date.trim() === ''));
      break;
    case 'recurring':
      displayedTasks = tasks.filter(t => t.recurrence && t.recurrence !== 'none');
      break;
    case 'completed':
      displayedTasks = tasks.filter(t => t.status === 'completed');
      break;
  }

  // Kişisel / Aile Filtresi
  if (filterType === 'personal') {
    displayedTasks = displayedTasks.filter(t => t.is_family_shared === 0);
  } else if (filterType === 'family') {
    displayedTasks = displayedTasks.filter(t => t.is_family_shared === 1);
  }

  // Pillar Filtresi
  if (selectedPillar !== 'all') {
    displayedTasks = displayedTasks.filter(t => t.pillar === selectedPillar);
  }

  // Aile Üyesi Filtresi
  if (selectedMember !== 'all') {
    displayedTasks = displayedTasks.filter(t => t.assigned_member_id === selectedMember);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-glass" role="status" aria-live="polite">
          {toastMsg}
        </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
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
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}
                >
                  {mitSummary.completedMitCount} / {Math.min(3, Math.max(todayMitTasks.length, 3))} Tamamlandı
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '10px'
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
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    minHeight: '64px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={16} />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* 6 Akıllı Sekme */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { id: 'today', label: '☀️ Bugün', count: tasks.filter(t => t.due_date === todayStr || (t.due_date && t.due_date < todayStr) || t.is_mit === 1).length },
              { id: 'upcoming', label: '📅 Yaklaşan', count: tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date > todayStr).length },
              { id: 'backlog', label: '📥 Backlog', count: tasks.filter(t => t.status !== 'completed' && (!t.due_date || t.due_date.trim() === '')).length },
              { id: 'recurring', label: '🔄 Rutinler', count: tasks.filter(t => t.recurrence && t.recurrence !== 'none').length },
              { id: 'bridge', label: '🌉 Sistem Köprüsü', count: crossModuleActions.length },
              { id: 'completed', label: '✅ Tamamlananlar', count: tasks.filter(t => t.status === 'completed').length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: `1px solid ${activeTab === tab.id ? 'var(--text-main)' : 'var(--border)'}`,
                  background: activeTab === tab.id ? 'var(--text-main)' : 'var(--surface-subtle)',
                  color: activeTab === tab.id ? 'var(--bg-main)' : 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '999px',
                    background: activeTab === tab.id ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)',
                    fontWeight: 700
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Kişisel / Aile Filtre Hapları */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'personal', label: '🔒 Kişisel' },
              { id: 'family', label: '👨‍👩‍👧 Aile' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id as any)}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: filterType === f.id ? 'var(--surface)' : 'transparent',
                  color: filterType === f.id ? 'var(--emerald)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pillar & Üye Filtre Çubuğu */}
        {activeTab !== 'bridge' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={12} /> Alan:
            </span>
            <button
              type="button"
              onClick={() => setSelectedPillar('all')}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: selectedPillar === 'all' ? 'var(--text-main)' : 'var(--surface-subtle)',
                color: selectedPillar === 'all' ? 'var(--bg-main)' : 'var(--text-muted)',
                cursor: 'pointer'
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
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${isSelected ? cfg.color : 'var(--border)'}`,
                    background: isSelected ? cfg.bg : 'var(--surface-subtle)',
                    color: isSelected ? cfg.color : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
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
      {activeTab === 'bridge' ? (
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
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  borderLeft: `4px solid ${action.priority === 'critical' ? '#EF4444' : '#F59E0B'}`
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Link
                    href={action.action_url}
                    className="btn-subtle"
                    style={{ fontSize: '11px', padding: '6px 10px', textDecoration: 'none' }}
                  >
                    <span>Modüle Git</span>
                    <ArrowRight size={12} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleImportCrossModule(action)}
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '6px 12px', fontWeight: 800 }}
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
          {displayedTasks.length === 0 ? (
            <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {activeTab === 'completed' ? 'Henüz tamamlanan görev yok' : 'Bu görünümde görev bulunmuyor'}
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
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: isDone ? 'rgba(255, 255, 255, 0.01)' : 'var(--surface)',
                    borderLeft: `4px solid ${isDone ? 'var(--border)' : pillarCfg.color}`,
                    opacity: isDone ? 0.75 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
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
                          style={{
                            background: task.is_mit === 1 ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-subtle)',
                            border: `1px solid ${task.is_mit === 1 ? 'rgba(245, 158, 11, 0.3)' : 'var(--border)'}`,
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: task.is_mit === 1 ? '#F59E0B' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
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
                        style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        title="Görevi Düzenle"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Sil */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--rose)',
                          cursor: 'pointer'
                        }}
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
