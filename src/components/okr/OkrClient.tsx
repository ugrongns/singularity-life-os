'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Target,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  Users,
  Activity,
  History,
  Sparkles,
  X,
} from 'lucide-react';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import {
  OKR_CONFIDENCE_META,
  OKR_PERIODS,
  OKR_STATUS_META,
  OkrCheckInItem,
  OkrConfidence,
  OkrKeyResultItem,
  OkrObjectiveItem,
  VISION_PILLARS,
  calculateKeyResultProgress,
  calculateObjectiveProgress,
  getDefaultOkrPeriod,
  getVisionPillarMeta,
  summarizeOkrConfidence,
} from '@/lib/okr-engine';
import PageLoadingState from '@/components/ui/PageLoadingState';

interface LiveMetrics {
  books_year: number;
  sinking_fund: number;
  workouts_30d: number;
  tasks_30d: number;
  habits_score: number;
}

const CONFIDENCE_STYLES: Record<
  OkrConfidence,
  { background: string; color: string; border: string }
> = {
  on_track: {
    background: 'rgba(16, 185, 129, 0.14)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.32)',
  },
  needs_attention: {
    background: 'rgba(245, 158, 11, 0.14)',
    color: '#F59E0B',
    border: '1px solid rgba(245, 158, 11, 0.32)',
  },
  at_risk: {
    background: 'rgba(239, 68, 68, 0.14)',
    color: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.32)',
  },
};

function parseNumericInput(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

export default function OkrClient() {
  const defaultPeriod = useMemo(() => getDefaultOkrPeriod(getTodayTurkeyDate()), []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<OkrObjectiveItem[]>([]);
  const [keyResults, setKeyResults] = useState<OkrKeyResultItem[]>([]);
  const [checkIns, setCheckIns] = useState<OkrCheckInItem[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    books_year: 0,
    sinking_fund: 0,
    workouts_30d: 0,
    tasks_30d: 0,
    habits_score: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [historyKrId, setHistoryKrId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  // Objective modal
  const [objModalOpen, setObjModalOpen] = useState<boolean>(false);
  const [editingObj, setEditingObj] = useState<OkrObjectiveItem | null>(null);
  const [objTitle, setObjTitle] = useState<string>('');
  const [objDesc, setObjDesc] = useState<string>('');
  const [objPillar, setObjPillar] = useState<string>('pillar_career');
  const [objPeriod, setObjPeriod] = useState<string>(defaultPeriod);
  const [objStatus, setObjStatus] = useState<string>('in_progress');
  const [objConfidence, setObjConfidence] = useState<string>('on_track');
  const [objShared, setObjShared] = useState<boolean>(false);

  // KR modal
  const [krModalOpen, setKrModalOpen] = useState<boolean>(false);
  const [krTargetObjId, setKrTargetObjId] = useState<string>('');
  const [krTitle, setKrTitle] = useState<string>('');
  const [krType, setKrType] = useState<string>('numeric');
  const [krStart, setKrStart] = useState<string>('0');
  const [krTarget, setKrTarget] = useState<string>('100');
  const [krCurrent, setKrCurrent] = useState<string>('0');
  const [krUnit, setKrUnit] = useState<string>('adet');
  const [krWeight, setKrWeight] = useState<string>('1');
  const [krLinkedModule, setKrLinkedModule] = useState<string>('');

  // Check-in modal
  const [ciModalKr, setCiModalKr] = useState<OkrKeyResultItem | null>(null);
  const [ciNewValue, setCiNewValue] = useState<string>('0');
  const [ciConfidence, setCiConfidence] = useState<string>('on_track');
  const [ciNote, setCiNote] = useState<string>('');

  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'objective' | 'kr';
    id: string;
    title: string;
  } | null>(null);

  const notify = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchOkrData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/okr?period=${encodeURIComponent(selectedPeriod)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const objs: OkrObjectiveItem[] = json.data.objectives ?? [];
        if (typeof json.data.currentUserId === 'string') {
          setCurrentUserId(json.data.currentUserId);
        }
        setObjectives(objs);
        setKeyResults(json.data.keyResults ?? []);
        setCheckIns(json.data.checkIns ?? []);
        if (json.data.liveMetrics) setLiveMetrics(json.data.liveMetrics);
        setExpandedIds((prev) => {
          if (prev.size > 0) return prev;
          return new Set(objs.map((o) => o.id));
        });
      } else {
        notify(json.error || 'OKR verileri yüklenemedi.', 'err');
      }
    } catch {
      notify('Bağlantı hatası.', 'err');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, notify]);

  useEffect(() => {
    void fetchOkrData();
  }, [fetchOkrData]);

  const enrichedObjectives = useMemo(() => {
    return objectives
      .filter((o) => selectedPillar === 'all' || o.pillar_id === selectedPillar)
      .map((o) => ({
        ...o,
        keyResults: keyResults.filter((kr) => kr.objective_id === o.id),
      }));
  }, [objectives, keyResults, selectedPillar]);

  const summary = useMemo(
    () => summarizeOkrConfidence(enrichedObjectives),
    [enrichedObjectives]
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateObjective = () => {
    setEditingObj(null);
    setObjTitle('');
    setObjDesc('');
    setObjPillar(selectedPillar === 'all' ? 'pillar_career' : selectedPillar);
    setObjPeriod(selectedPeriod === 'all' ? defaultPeriod : selectedPeriod);
    setObjStatus('in_progress');
    setObjConfidence('on_track');
    setObjShared(false);
    setObjModalOpen(true);
  };

  const openEditObjective = (obj: OkrObjectiveItem) => {
    setEditingObj(obj);
    setObjTitle(obj.title);
    setObjDesc(obj.description || '');
    setObjPillar(obj.pillar_id);
    setObjPeriod(obj.period);
    setObjStatus(obj.status);
    setObjConfidence(obj.confidence);
    setObjShared(obj.is_family_shared === 1);
    setObjModalOpen(true);
  };

  const handleSaveObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objTitle.trim()) return;
    try {
      const res = await fetch('/api/okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingObj ? 'update_objective' : 'create_objective',
          id: editingObj?.id,
          title: objTitle.trim(),
          description: objDesc.trim(),
          pillar_id: objPillar,
          period: objPeriod,
          status: objStatus,
          confidence: objConfidence,
          is_family_shared: objShared,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify(editingObj ? 'Hedef güncellendi.' : 'Hedef oluşturuldu.');
        setObjModalOpen(false);
        void fetchOkrData();
      } else {
        notify(json.error || 'İşlem başarısız.', 'err');
      }
    } catch {
      notify('Kayıt hatası.', 'err');
    }
  };

  const handleDeleteObjective = async (id: string) => {
    try {
      const res = await fetch('/api/okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_objective', id }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Hedef silindi.');
        void fetchOkrData();
      } else {
        notify(json.error || 'Silinemedi.', 'err');
      }
    } catch {
      notify('Silme hatası.', 'err');
    }
  };

  const openCreateKr = (objectiveId: string) => {
    setKrTargetObjId(objectiveId);
    setKrTitle('');
    setKrType('numeric');
    setKrStart('0');
    setKrTarget('100');
    setKrCurrent('0');
    setKrUnit('adet');
    setKrWeight('1');
    setKrLinkedModule('');
    setKrModalOpen(true);
  };

  const applySuggestion = (
    moduleKey: string,
    title: string,
    currentVal: number,
    targetVal: number,
    unit: string,
    type: string = 'numeric'
  ) => {
    setKrLinkedModule(moduleKey);
    setKrTitle(title);
    setKrCurrent(String(currentVal));
    setKrTarget(String(targetVal));
    setKrUnit(unit);
    setKrType(type);
  };

  const handleSaveKr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!krTitle.trim()) return;
    try {
      const res = await fetch('/api/okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_kr',
          objective_id: krTargetObjId,
          title: krTitle.trim(),
          kr_type: krType,
          start_value: parseNumericInput(krStart, 0),
          target_value: parseNumericInput(krTarget, 100),
          current_value: parseNumericInput(krCurrent, 0),
          unit: krUnit.trim() || 'adet',
          weight: Math.max(0.1, parseNumericInput(krWeight, 1)),
          linked_module: krLinkedModule || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Anahtar Sonuç (KR) eklendi.');
        setKrModalOpen(false);
        void fetchOkrData();
      } else {
        notify(json.error || 'Eklenemedi.', 'err');
      }
    } catch {
      notify('Kayıt hatası.', 'err');
    }
  };

  const handleDeleteKr = async (id: string) => {
    try {
      const res = await fetch('/api/okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_kr', id }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Anahtar Sonuç silindi.');
        void fetchOkrData();
      } else {
        notify(json.error || 'Silinemedi.', 'err');
      }
    } catch {
      notify('Silme hatası.', 'err');
    }
  };

  const openCheckIn = (kr: OkrKeyResultItem) => {
    setCiModalKr(kr);
    setCiNewValue(String(kr.current_value));
    setCiConfidence(kr.confidence || 'on_track');
    setCiNote('');
  };

  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciModalKr) return;
    try {
      const res = await fetch('/api/okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_check_in',
          key_result_id: ciModalKr.id,
          new_value: Number(ciNewValue),
          confidence: ciConfidence,
          note: ciNote.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Check-in kaydedildi.');
        setCiModalKr(null);
        void fetchOkrData();
      } else {
        notify(json.error || 'Check-in başarısız.', 'err');
      }
    } catch {
      notify('Check-in hatası.', 'err');
    }
  };

  return (
    <div style={{ padding: '0 16px 28px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {toast && (
        <div
          className="toast-glass"
          role="status"
          aria-live="polite"
          style={{
            zIndex: 1200,
            borderColor: toast.type === 'ok' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
            color: toast.type === 'ok' ? 'var(--emerald)' : 'var(--rose)',
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '21px', fontWeight: 900, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Target size={22} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
            <span>OKR &amp; Stratejik Yaşam Vizyonu</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            6 yaşam sütunu altında çeyreklik hedefler belirle, ölçülebilir anahtar sonuçlarla check-in yap.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input"
            aria-label="OKR Dönemi"
            style={{ width: 'auto', minWidth: '150px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '10px' }}
          >
            <option value="all">Tüm Dönemler</option>
            {OKR_PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openCreateObjective}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#10B981', borderColor: '#059669' }}
          >
            <Plus size={15} />
            <span>Yeni Hedef</span>
          </button>
        </div>
      </div>

      {/* Summary & Live Singularity Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Ortalama İlerleme
          </div>
          <div className="tabular-nums" style={{ fontSize: '26px', fontWeight: 900, color: 'var(--emerald)', marginTop: '4px' }}>
            %{summary.averageProgress}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {summary.totalObjectives} hedef ({summary.completedObjectives} tamamlandı)
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Güven Durumu
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginTop: '10px', fontSize: '12px', fontWeight: 700 }}>
            <span style={{ color: '#10B981', whiteSpace: 'nowrap' }}>● {summary.onTrackCount} Yolunda</span>
            <span style={{ color: '#F59E0B', whiteSpace: 'nowrap' }}>● {summary.needsAttentionCount} Dikkat</span>
            <span style={{ color: '#EF4444', whiteSpace: 'nowrap' }}>● {summary.atRiskCount} Risk</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', gridColumn: 'span 1' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
            <Sparkles size={13} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
            <span>Canlı Singularity Metrikleri</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: '10px', fontSize: '12px', color: 'var(--text-main)' }}>
            <span style={{ whiteSpace: 'nowrap' }}>📚 Yıllık Kitap: <strong className="tabular-nums">{liveMetrics.books_year}</strong></span>
            <span style={{ whiteSpace: 'nowrap' }}>💎 Birikim Fonu: <strong className="tabular-nums">{liveMetrics.sinking_fund.toLocaleString('tr-TR')} ₺</strong></span>
            <span style={{ whiteSpace: 'nowrap' }}>💪 30G Antrenman: <strong className="tabular-nums">{liveMetrics.workouts_30d}</strong></span>
            <span style={{ whiteSpace: 'nowrap' }}>✅ 30G Görev: <strong className="tabular-nums">{liveMetrics.tasks_30d}</strong></span>
            <span style={{ whiteSpace: 'nowrap' }}>🔁 7G Alışkanlık: <strong className="tabular-nums">{liveMetrics.habits_score}</strong></span>
          </div>
        </div>
      </div>

      {/* 6 Vision Pillars Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setSelectedPillar('all')}
          className={`choice-pill ${selectedPillar === 'all' ? 'selected' : ''}`}
          style={{
            padding: '6px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            border: selectedPillar === 'all' ? '1px solid var(--primary)' : '1px solid var(--border)',
            background: selectedPillar === 'all' ? 'var(--primary)' : 'var(--surface)',
            color: selectedPillar === 'all' ? '#FFFFFF' : 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          Tümü
        </button>
        {VISION_PILLARS.map((pillar) => {
          const isActive = selectedPillar === pillar.id;
          return (
            <button
              key={pillar.id}
              type="button"
              onClick={() => setSelectedPillar(pillar.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                border: isActive ? `1px solid ${pillar.color}` : '1px solid var(--border)',
                background: isActive ? `${pillar.color}22` : 'var(--surface)',
                color: isActive ? pillar.color : 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span>{pillar.emoji}</span>
              <span>{pillar.label}</span>
            </button>
          );
        })}
      </div>

      {/* Objectives List */}
      {loading ? (
        <PageLoadingState
          icon="🎯"
          title="OKR Hedefleri Yükleniyor..."
          description="Yaşam vizyonu hedefleri, anahtar sonuçlar ve canlı metrikler hazırlanıyor"
          color="#10B981"
        />
      ) : enrichedObjectives.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            borderStyle: 'dashed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Bu filtrede henüz tanımlı bir hedef (Objective) bulunmuyor.
          </div>
          <button
            type="button"
            onClick={openCreateObjective}
            className="btn-primary"
            style={{ padding: '9px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#10B981', borderColor: '#059669' }}
          >
            <Plus size={15} />
            <span>İlk Hedefi Oluştur</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {enrichedObjectives.map((obj) => {
            const pillar = getVisionPillarMeta(obj.pillar_id);
            const confKey = (obj.confidence as OkrConfidence) || 'on_track';
            const confMeta = OKR_CONFIDENCE_META[confKey] ?? OKR_CONFIDENCE_META.on_track;
            const confStyle = CONFIDENCE_STYLES[confKey] ?? CONFIDENCE_STYLES.on_track;
            const progress = calculateObjectiveProgress(obj.keyResults ?? []);
            const isExpanded = expandedIds.has(obj.id);
            const isObjOwner = !currentUserId || obj.user_id === currentUserId;

            return (
              <div
                key={obj.id}
                className="card"
                style={{ overflow: 'hidden', padding: 0 }}
              >
                <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: '1 1 260px' }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(obj.id)}
                      className="btn-subtle"
                      aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
                      style={{ marginTop: '2px', padding: '5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            borderLeft: `3px solid ${pillar.color}`,
                            background: 'var(--surface-subtle)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {pillar.emoji} {pillar.label}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'var(--surface-subtle)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {obj.period}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            ...confStyle,
                          }}
                        >
                          {confMeta.label}
                        </span>
                        {obj.is_family_shared === 1 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(236, 72, 153, 0.14)',
                              color: '#EC4899',
                              border: '1px solid rgba(236, 72, 153, 0.32)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Users size={11} />
                            <span>Aile</span>
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)', wordBreak: 'break-word' }}>
                        {obj.title}
                      </h3>
                      {obj.description && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          {obj.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '2px' }}>
                        <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              borderRadius: '999px',
                              width: `${progress}%`,
                              backgroundColor: pillar.color,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', minWidth: '38px', textAlign: 'right' }}>
                          %{progress}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {isObjOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openCreateKr(obj.id)}
                          style={{
                            padding: '6px 11px',
                            borderRadius: '9px',
                            background: 'rgba(16, 185, 129, 0.16)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: 'var(--emerald)',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={14} />
                          <span>KR Ekle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditObjective(obj)}
                          className="btn-subtle"
                          style={{ padding: '7px', borderRadius: '9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Hedefi düzenle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ type: 'objective', id: obj.id, title: obj.title })}
                          className="btn-subtle"
                          style={{ padding: '7px', borderRadius: '9px', color: 'var(--rose)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Hedefi sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 9px',
                          borderRadius: '8px',
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Salt Okunur
                      </span>
                    )}
                  </div>
                </div>

                {/* Key Results */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-subtle)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(obj.keyResults ?? []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
                        Henüz anahtar sonuç (KR) eklenmemiş. Sağdaki &ldquo;KR Ekle&rdquo; butonunu kullan.
                      </div>
                    ) : (
                      (obj.keyResults ?? []).map((kr) => {
                        const krPct = calculateKeyResultProgress(kr);
                        const krConfKey = (kr.confidence as OkrConfidence) || 'on_track';
                        const krConf = OKR_CONFIDENCE_META[krConfKey] ?? OKR_CONFIDENCE_META.on_track;
                        const krConfStyle = CONFIDENCE_STYLES[krConfKey] ?? CONFIDENCE_STYLES.on_track;
                        const krHistory = checkIns.filter((c) => c.key_result_id === kr.id);
                        const isHistoryOpen = historyKrId === kr.id;
                        const isKrOwner = !currentUserId || kr.user_id === currentUserId;

                        return (
                          <div
                            key={kr.id}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    {kr.title}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      ...krConfStyle,
                                    }}
                                  >
                                    {krConf.label}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Ağırlık: x{kr.weight}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  <strong className="tabular-nums" style={{ color: 'var(--text-main)' }}>{kr.current_value}</strong> / {kr.target_value} {kr.unit} (Başlangıç: {kr.start_value})
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {isKrOwner && (
                                  <button
                                    type="button"
                                    onClick={() => openCheckIn(kr)}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: 'rgba(99, 102, 241, 0.16)',
                                      border: '1px solid rgba(99, 102, 241, 0.35)',
                                      color: 'var(--indigo)',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Activity size={13} />
                                    <span>Check-in</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setHistoryKrId(isHistoryOpen ? null : kr.id)}
                                  className="btn-subtle"
                                  style={{ padding: '6px 9px', borderRadius: '8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <History size={13} />
                                  <span>({krHistory.length})</span>
                                </button>
                                {isKrOwner && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete({ type: 'kr', id: kr.id, title: kr.title })}
                                    className="btn-subtle"
                                    style={{ padding: '6px', borderRadius: '8px', color: 'var(--rose)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    aria-label="KR sil"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    borderRadius: '999px',
                                    background: '#10B981',
                                    width: `${krPct}%`,
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                              <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', minWidth: '34px', textAlign: 'right' }}>
                                %{krPct}
                              </span>
                            </div>

                            {isHistoryOpen && (
                              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {krHistory.length === 0 ? (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Henüz check-in kaydı yok.
                                  </div>
                                ) : (
                                  krHistory.map((ci) => (
                                    <div
                                      key={ci.id}
                                      style={{
                                        fontSize: '11px',
                                        color: 'var(--text-muted)',
                                        background: 'var(--surface-subtle)',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                      }}
                                    >
                                      <strong style={{ color: 'var(--text-main)' }}>{ci.check_in_date}</strong>: {ci.previous_value} →{' '}
                                      <strong style={{ color: 'var(--emerald)' }}>{ci.new_value}</strong>{' '}
                                      {kr.unit}
                                      {ci.note ? ` — "${ci.note}"` : ''}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Objective Modal */}
      {objModalOpen && (
        <div className="modal-overlay" onClick={() => setObjModalOpen(false)} style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', width: '100%', padding: '20px', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingObj ? 'Hedefi Düzenle' : 'Yeni Stratejik Hedef (Objective)'}
              </h2>
              <button
                type="button"
                onClick={() => setObjModalOpen(false)}
                className="modal-close-btn"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveObjective} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Hedef Başlığı
                </label>
                <input
                  type="text"
                  value={objTitle}
                  onChange={(e) => setObjTitle(e.target.value)}
                  placeholder="Örn: Sağlıklı yaşam ve enerji seviyesini zirveye taşımak"
                  className="input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Açıklama
                </label>
                <textarea
                  rows={2}
                  value={objDesc}
                  onChange={(e) => setObjDesc(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Yaşam Sütunu
                  </label>
                  <select
                    value={objPillar}
                    onChange={(e) => setObjPillar(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    {VISION_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Dönem
                  </label>
                  <select
                    value={objPeriod}
                    onChange={(e) => setObjPeriod(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    {OKR_PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editingObj && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Durum
                    </label>
                    <select
                      value={objStatus}
                      onChange={(e) => setObjStatus(e.target.value)}
                      className="input"
                      style={{ width: '100%' }}
                    >
                      {Object.entries(OKR_STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Güven
                    </label>
                    <select
                      value={objConfidence}
                      onChange={(e) => setObjConfidence(e.target.value)}
                      className="input"
                      style={{ width: '100%' }}
                    >
                      {Object.entries(OKR_CONFIDENCE_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={objShared}
                  onChange={(e) => setObjShared(e.target.checked)}
                />
                <span>Aileyle Paylaş (ortak aile hedefi olarak görünsün)</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setObjModalOpen(false)}
                  className="btn-subtle"
                  style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', background: '#10B981', borderColor: '#059669' }}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Key Result Modal */}
      {krModalOpen && (
        <div className="modal-overlay" onClick={() => setKrModalOpen(false)} style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%', padding: '20px', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Yeni Anahtar Sonuç (Key Result)
              </h2>
              <button
                type="button"
                onClick={() => setKrModalOpen(false)}
                className="modal-close-btn"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--indigo)' }}>
                Singularity Modüllerinden Hızlı Doldur:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() =>
                    applySuggestion(
                      'library',
                      'Bu yıl 12 kitap bitir',
                      liveMetrics.books_year,
                      12,
                      'kitap'
                    )
                  }
                  className="btn-subtle"
                  style={{ padding: '5px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}
                >
                  📚 Kitap ({liveMetrics.books_year})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySuggestion(
                      'budget',
                      'Acil durum birikim hedefi',
                      liveMetrics.sinking_fund,
                      Math.max(50000, liveMetrics.sinking_fund + 10000),
                      '₺',
                      'currency'
                    )
                  }
                  className="btn-subtle"
                  style={{ padding: '5px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}
                >
                  💎 Birikim ({liveMetrics.sinking_fund.toLocaleString('tr-TR')} ₺)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySuggestion(
                      'wellness',
                      'Aylık 16 antrenman tamamla',
                      liveMetrics.workouts_30d,
                      16,
                      'seans'
                    )
                  }
                  className="btn-subtle"
                  style={{ padding: '5px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}
                >
                  💪 Spor ({liveMetrics.workouts_30d})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySuggestion(
                      'tasks',
                      'Aylık 30 görev tamamla',
                      liveMetrics.tasks_30d,
                      Math.max(30, liveMetrics.tasks_30d + 10),
                      'görev'
                    )
                  }
                  className="btn-subtle"
                  style={{ padding: '5px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}
                >
                  ✅ Görev ({liveMetrics.tasks_30d})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySuggestion(
                      'habits',
                      'Haftalık 21 alışkanlık tamamla',
                      liveMetrics.habits_score,
                      Math.max(21, liveMetrics.habits_score + 7),
                      'tamamlama'
                    )
                  }
                  className="btn-subtle"
                  style={{ padding: '5px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}
                >
                  🔁 Alışkanlık ({liveMetrics.habits_score})
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveKr} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  KR Başlığı
                </label>
                <input
                  type="text"
                  value={krTitle}
                  onChange={(e) => setKrTitle(e.target.value)}
                  placeholder="Örn: Haftada 4 gün 45 dk koşu/antrenman yap"
                  className="input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Ölçüm Tipi
                  </label>
                  <select
                    value={krType}
                    onChange={(e) => setKrType(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    <option value="numeric">Sayısal</option>
                    <option value="percentage">Yüzde (%)</option>
                    <option value="currency">Para Birimi (₺)</option>
                    <option value="boolean">Evet/Hayır (0/1)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Birim
                  </label>
                  <input
                    type="text"
                    value={krUnit}
                    onChange={(e) => setKrUnit(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Başlangıç
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={krStart}
                    onChange={(e) => setKrStart(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Mevcut
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={krCurrent}
                    onChange={(e) => setKrCurrent(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Hedef
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={krTarget}
                    onChange={(e) => setKrTarget(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Ağırlık
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={krWeight}
                    onChange={(e) => setKrWeight(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setKrModalOpen(false)}
                  className="btn-subtle"
                  style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', background: '#10B981', borderColor: '#059669' }}
                >
                  KR Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {ciModalKr && (
        <div className="modal-overlay" onClick={() => setCiModalKr(null)} style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', width: '100%', padding: '20px', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                İlerleme Check-in
              </h2>
              <button
                type="button"
                onClick={() => setCiModalKr(null)}
                className="modal-close-btn"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                fontSize: '12px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ciModalKr.title}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                Önceki: {ciModalKr.current_value} / Hedef: {ciModalKr.target_value} {ciModalKr.unit}
              </div>
            </div>

            <form onSubmit={handleSaveCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Yeni Değer ({ciModalKr.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ciNewValue}
                  onChange={(e) => setCiNewValue(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Güven Durumu
                </label>
                <select
                  value={ciConfidence}
                  onChange={(e) => setCiConfidence(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  {Object.entries(OKR_CONFIDENCE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Check-in Notu
                </label>
                <textarea
                  rows={2}
                  value={ciNote}
                  onChange={(e) => setCiNote(e.target.value)}
                  placeholder="Bu hafta neler oldu, engel var mı?"
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCiModalKr(null)}
                  className="btn-subtle"
                  style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', background: '#6366F1', borderColor: '#4F46E5' }}
                >
                  Check-in Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)} style={{ zIndex: 1150 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', width: '100%', padding: '20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {confirmDelete.type === 'objective' ? 'Hedefi Sil' : 'Anahtar Sonucu Sil'}
              </h2>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="modal-close-btn"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-main)' }}>&ldquo;{confirmDelete.title}&rdquo;</strong>{' '}
              {confirmDelete.type === 'objective'
                ? 'hedefini silmek istediğinize emin misiniz? Bağlı tüm anahtar sonuçlar (KR) ve check-in kayıtları da kalıcı olarak silinecektir.'
                : 'anahtar sonucunu ve check-in geçmişini kalıcı olarak silmek istediğinize emin misiniz?'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="btn-subtle"
                style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px' }}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  if (target.type === 'objective') {
                    await handleDeleteObjective(target.id);
                  } else {
                    await handleDeleteKr(target.id);
                  }
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', background: '#EF4444', borderColor: '#DC2626' }}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
