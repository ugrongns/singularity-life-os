'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Flame,
  Users,
  Repeat,
  Tag,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  TaskItem,
  TaskPillar,
  TaskPriority,
  TaskRecurrence,
  Subtask,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS
} from '@/lib/tasks-engine';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
  members?: Array<{ id: string; name: string; avatar: string }>;
  initialData?: Partial<TaskItem> | null;
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  members = [],
  initialData = null
}: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pillar, setPillar] = useState<TaskPillar>('general');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isMit, setIsMit] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [isFamilyShared, setIsFamilyShared] = useState(false);
  const [assignedMemberId, setAssignedMemberId] = useState('');
  
  // Alt görevler
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setPillar((initialData.pillar as TaskPillar) || 'general');
        setPriority((initialData.priority as TaskPriority) || 'medium');
        setIsMit(Boolean(initialData.is_mit));
        setDueDate(initialData.due_date || '');
        setDueTime(initialData.due_time || '');
        setRecurrence((initialData.recurrence as TaskRecurrence) || 'none');
        setIsFamilyShared(Boolean(initialData.is_family_shared));
        setAssignedMemberId(initialData.assigned_member_id || '');
        setSubtasks(initialData.subtasks || []);
      } else {
        // Sıfırdan ekleme
        setTitle('');
        setDescription('');
        setPillar('general');
        setPriority('medium');
        setIsMit(false);
        setDueDate(new Date().toISOString().slice(0, 10)); // Bugün
        setDueTime('');
        setRecurrence('none');
        setIsFamilyShared(false);
        setAssignedMemberId('');
        setSubtasks([]);
      }
      setNewSubtaskTitle('');
      setError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const item: Subtask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: newSubtaskTitle.trim(),
      is_completed: false
    };
    setSubtasks([...subtasks, item]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Lütfen görev başlığını girin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isEditing = Boolean(initialData?.id);
      const payload: any = {
        action: isEditing ? 'update' : 'create',
        title: title.trim(),
        description: description.trim() || null,
        pillar,
        priority,
        is_mit: isMit ? 1 : 0,
        due_date: dueDate || null,
        due_time: dueTime || null,
        recurrence,
        is_family_shared: isFamilyShared ? 1 : 0,
        assigned_member_id: isFamilyShared && assignedMemberId ? assignedMemberId : null,
        subtasks
      };

      if (isEditing) {
        payload.task_id = initialData?.id;
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'İşlem başarısız.');
        return;
      }

      onSuccess(isEditing ? 'Görev güncellendi.' : 'Yeni görev eklendi! 🎯');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}
      >
        <div className="sheet-handle" />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🎯</span>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {initialData?.id ? 'Görevi Düzenle' : 'Yeni Görev & Odak Belirle'}
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Görev oluşturun, alt adımlara bölün ve günün odağına alın.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--rose-bg)',
              color: 'var(--rose)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, paddingRight: '4px' }}>
          {/* Başlık */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
              GÖREV BAŞLIĞI *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Örn: 2026 Gelir Vergisi beyannamesini tamamla"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600
              }}
            />
          </div>

          {/* Açıklama / Notlar */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
              AÇIKLAMA / NOTLAR
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="İlgili detaylar, linkler veya hatırlatmalar..."
              rows={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                fontSize: '12px',
                resize: 'none'
              }}
            />
          </div>

          {/* Yaşam Sütunu (Pillars) */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>
              YAŞAM SÜTUNU (PILLAR)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.keys(PILLAR_CONFIGS) as TaskPillar[]).map(pKey => {
                const cfg = PILLAR_CONFIGS[pKey];
                const isSelected = pillar === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setPillar(pKey)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? cfg.color : 'var(--border)'}`,
                      background: isSelected ? cfg.bg : 'var(--surface-subtle)',
                      color: isSelected ? cfg.color : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Öncelik & MIT Kalkanı */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
            {/* Öncelik */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                ÖNCELİK
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(Object.keys(PRIORITY_CONFIGS) as TaskPriority[]).map(prKey => {
                  const pCfg = PRIORITY_CONFIGS[prKey];
                  const isSelected = priority === prKey;
                  return (
                    <button
                      key={prKey}
                      type="button"
                      onClick={() => setPriority(prKey)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isSelected ? pCfg.color : 'var(--border)'}`,
                        background: isSelected ? pCfg.bg : 'var(--surface-subtle)',
                        color: isSelected ? pCfg.color : 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {pCfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 🔥 MIT Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                GÜNÜN ODAĞI (MIT)
              </label>
              <button
                type="button"
                onClick={() => setIsMit(!isMit)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isMit ? '#F59E0B' : 'var(--border)'}`,
                  background: isMit ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-subtle)',
                  color: isMit ? '#F59E0B' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Flame size={15} color={isMit ? '#F59E0B' : 'currentColor'} />
                <span>{isMit ? '🔥 Günün Odağı (MIT)' : 'Normal Görev'}</span>
              </button>
            </div>
          </div>

          {/* Tarih, Saat ve Tekrarlama */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                VADE TARİHİ
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                SAAT (OPSİYONEL)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                TEKRARLAMA
              </label>
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as TaskRecurrence)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px'
                }}
              >
                <option value="none">Tek Seferlik</option>
                <option value="daily">Her Gün</option>
                <option value="weekly">Her Hafta</option>
                <option value="monthly">Her Ay</option>
              </select>
            </div>
          </div>

          {/* Alt Görevler (Checklist Builder) */}
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)' }}>
                ALT GÖREVLER (CHECKLIST) ({subtasks.length})
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Büyük işleri küçük adımlara bölün</span>
            </div>

            {/* Alt Görev Listesi */}
            {subtasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {subtasks.map((st, idx) => (
                  <div
                    key={st.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ color: 'var(--text-main)' }}>• {st.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                      title="Alt görevi sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Yeni Alt Görev Ekleme Kutusu */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Alt görev ekle (Örn: Belgeleri tara)..."
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-main)',
                  fontSize: '12px'
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="btn-subtle"
                style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700 }}
              >
                <Plus size={14} /> Ekle
              </button>
            </div>
          </div>

          {/* Aile Paylaşımı & Atama */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isFamilyShared}
                onChange={e => setIsFamilyShared(e.target.checked)}
                style={{ accentColor: '#10B981', width: '16px', height: '16px' }}
              />
              <span>👨‍👩‍👧 Aile Üyeleriyle Paylaş (Hane Görevi)</span>
            </label>

            {isFamilyShared && members.length > 0 && (
              <div style={{ paddingLeft: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  GÖREVLİ AİLE ÜYESİ (OPSİYONEL)
                </label>
                <select
                  value={assignedMemberId}
                  onChange={e => setAssignedMemberId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '12px'
                  }}
                >
                  <option value="">Atama Yapılmadı (Tüm Aile)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.avatar} {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700, marginTop: 0, width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800, marginTop: 0, width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {loading ? 'Kaydediliyor...' : initialData?.id ? '💾 Değişiklikleri Kaydet' : '🎯 Görevi Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
