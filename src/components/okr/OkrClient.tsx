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

interface LiveMetrics {
  books_year: number;
  sinking_fund: number;
  workouts_30d: number;
  tasks_30d: number;
  habits_score: number;
}

export default function OkrClient() {
  const defaultPeriod = useMemo(() => getDefaultOkrPeriod(getTodayTurkeyDate()), []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
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
    fetchOkrData();
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
        fetchOkrData();
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
        fetchOkrData();
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
          start_value: Number(krStart) || 0,
          target_value: Number(krTarget) || 100,
          current_value: Number(krCurrent) || 0,
          unit: krUnit.trim() || 'adet',
          weight: Number(krWeight) || 1,
          linked_module: krLinkedModule || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify('Anahtar Sonuç (KR) eklendi.');
        setKrModalOpen(false);
        fetchOkrData();
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
        fetchOkrData();
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
        fetchOkrData();
      } else {
        notify(json.error || 'Check-in başarısız.', 'err');
      }
    } catch {
      notify('Check-in hatası.', 'err');
    }
  };

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
            <Target className="w-6 h-6 text-emerald-400" />
            OKR & Stratejik Yaşam Vizyonu
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            6 yaşam sütunu altında çeyreklik hedefler belirle, ölçülebilir anahtar sonuçlarla check-in yap.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200"
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
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Hedef
          </button>
        </div>
      </div>

      {/* Summary & Live Singularity Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Ortalama İlerleme</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            %{summary.averageProgress}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.totalObjectives} hedef ({summary.completedObjectives} tamamlandı)
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Güven Durumu</div>
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold">
            <span className="text-emerald-400">● {summary.onTrackCount} Yolunda</span>
            <span className="text-amber-400">● {summary.needsAttentionCount} Dikkat</span>
            <span className="text-rose-400">● {summary.atRiskCount} Risk</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 col-span-2">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Canlı Singularity Metrikleri (KR Önerileri İçin)
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-200">
            <span>📚 Yıllık Kitap: <b>{liveMetrics.books_year}</b></span>
            <span>💎 Birikim Fonu: <b>{liveMetrics.sinking_fund.toLocaleString('tr-TR')} ₺</b></span>
            <span>💪 30G Antrenman: <b>{liveMetrics.workouts_30d}</b></span>
            <span>✅ 30G Görev: <b>{liveMetrics.tasks_30d}</b></span>
            <span>🔁 7G Alışkanlık: <b>{liveMetrics.habits_score}</b></span>
          </div>
        </div>
      </div>

      {/* 6 Vision Pillars Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedPillar('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            selectedPillar === 'all'
              ? 'bg-slate-100 text-slate-900 border-slate-100'
              : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          Tümü
        </button>
        {VISION_PILLARS.map((pillar) => (
          <button
            key={pillar.id}
            type="button"
            onClick={() => setSelectedPillar(pillar.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
              selectedPillar === pillar.id
                ? 'bg-slate-800 text-white border-indigo-500'
                : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span>{pillar.emoji}</span>
            <span>{pillar.label}</span>
          </button>
        ))}
      </div>

      {/* Objectives List */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-400">
          OKR hedefleri yükleniyor...
        </div>
      ) : enrichedObjectives.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <div className="text-sm text-slate-400">
            Bu filtrede henüz tanımlı bir hedef (Objective) bulunmuyor.
          </div>
          <button
            type="button"
            onClick={openCreateObjective}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            İlk Hedefi Oluştur
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {enrichedObjectives.map((obj) => {
            const pillar = getVisionPillarMeta(obj.pillar_id);
            const confMeta =
              OKR_CONFIDENCE_META[(obj.confidence as OkrConfidence) || 'on_track'] ??
              OKR_CONFIDENCE_META.on_track;
            const progress = calculateObjectiveProgress(obj.keyResults ?? []);
            const isExpanded = expandedIds.has(obj.id);

            return (
              <div
                key={obj.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(obj.id)}
                      className="mt-1 p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-700 bg-slate-950/70 text-slate-200"
                          style={{ borderLeftColor: pillar.color, borderLeftWidth: '3px' }}
                        >
                          {pillar.emoji} {pillar.label}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          {obj.period}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md border ${confMeta.bgClass}`}
                        >
                          {confMeta.label}
                        </span>
                        {obj.is_family_shared === 1 && (
                          <span className="text-[11px] bg-pink-500/15 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Aile
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-100">{obj.title}</h3>
                      {obj.description && (
                        <p className="text-xs text-slate-400">{obj.description}</p>
                      )}

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: pillar.color,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-200 w-10 text-right">
                          %{progress}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => openCreateKr(obj.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      KR Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditObjective(obj)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                      aria-label="Hedefi düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteObjective(obj.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300"
                      aria-label="Hedefi sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key Results */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-2.5">
                    {(obj.keyResults ?? []).length === 0 ? (
                      <div className="text-xs text-slate-500 py-2">
                        Henüz anahtar sonuç (KR) eklenmemiş. Sağdaki &ldquo;KR Ekle&rdquo; butonunu kullan.
                      </div>
                    ) : (
                      (obj.keyResults ?? []).map((kr) => {
                        const krPct = calculateKeyResultProgress(kr);
                        const krConf =
                          OKR_CONFIDENCE_META[(kr.confidence as OkrConfidence) || 'on_track'] ??
                          OKR_CONFIDENCE_META.on_track;
                        const krHistory = checkIns.filter((c) => c.key_result_id === kr.id);
                        const isHistoryOpen = historyKrId === kr.id;

                        return (
                          <div
                            key={kr.id}
                            className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-200">
                                    {kr.title}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded border ${krConf.bgClass}`}
                                  >
                                    {krConf.label}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Ağırlık: x{kr.weight}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {kr.current_value} / {kr.target_value} {kr.unit} (Başlangıç:{' '}
                                  {kr.start_value})
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openCheckIn(kr)}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium flex items-center gap-1 transition"
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                  Check-in
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setHistoryKrId(isHistoryOpen ? null : kr.id)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  ({krHistory.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKr(kr.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300"
                                  aria-label="KR sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${krPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-300 w-9 text-right">
                                %{krPct}
                              </span>
                            </div>

                            {isHistoryOpen && (
                              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                                {krHistory.length === 0 ? (
                                  <div className="text-[11px] text-slate-500">
                                    Henüz check-in kaydı yok.
                                  </div>
                                ) : (
                                  krHistory.map((ci) => (
                                    <div
                                      key={ci.id}
                                      className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 px-2.5 py-1.5 rounded-lg"
                                    >
                                      <span>
                                        <b>{ci.check_in_date}</b>: {ci.previous_value} →{' '}
                                        <b className="text-emerald-400">{ci.new_value}</b>{' '}
                                        {kr.unit}
                                        {ci.note ? ` — "${ci.note}"` : ''}
                                      </span>
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">
                {editingObj ? 'Hedefi Düzenle' : 'Yeni Stratejik Hedef (Objective)'}
              </h2>
              <button
                type="button"
                onClick={() => setObjModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveObjective} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hedef Başlığı</label>
                <input
                  type="text"
                  value={objTitle}
                  onChange={(e) => setObjTitle(e.target.value)}
                  placeholder="Örn: Sağlıklı yaşam ve enerji seviyesini zirveye taşımak"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Açıklama</label>
                <textarea
                  rows={2}
                  value={objDesc}
                  onChange={(e) => setObjDesc(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Yaşam Sütunu</label>
                  <select
                    value={objPillar}
                    onChange={(e) => setObjPillar(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  >
                    {VISION_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dönem</label>
                  <select
                    value={objPeriod}
                    onChange={(e) => setObjPeriod(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Durum</label>
                    <select
                      value={objStatus}
                      onChange={(e) => setObjStatus(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                    >
                      {Object.entries(OKR_STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Güven</label>
                    <select
                      value={objConfidence}
                      onChange={(e) => setObjConfidence(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
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

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={objShared}
                  onChange={(e) => setObjShared(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950"
                />
                Aileyle Paylaş (ortak aile hedefi olarak görünsün)
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setObjModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">
                Yeni Anahtar Sonuç (Key Result)
              </h2>
              <button
                type="button"
                onClick={() => setKrModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-[11px] text-indigo-300 font-medium">
                Singularity Modüllerinden Hızlı Doldur:
              </div>
              <div className="flex flex-wrap gap-1.5">
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
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
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
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
                >
                  💎 Birikim ({liveMetrics.sinking_fund} ₺)
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
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
                >
                  💪 Spor ({liveMetrics.workouts_30d})
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveKr} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">KR Başlığı</label>
                <input
                  type="text"
                  value={krTitle}
                  onChange={(e) => setKrTitle(e.target.value)}
                  placeholder="Örn: Haftada 4 gün 45 dk koşu/antrenman yap"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ölçüm Tipi</label>
                  <select
                    value={krType}
                    onChange={(e) => setKrType(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  >
                    <option value="numeric">Sayısal</option>
                    <option value="percentage">Yüzde (%)</option>
                    <option value="currency">Para Birimi (₺)</option>
                    <option value="boolean">Evet/Hayır (0/1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Birim</label>
                  <input
                    type="text"
                    value={krUnit}
                    onChange={(e) => setKrUnit(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Başlangıç</label>
                  <input
                    type="number"
                    step="any"
                    value={krStart}
                    onChange={(e) => setKrStart(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mevcut</label>
                  <input
                    type="number"
                    step="any"
                    value={krCurrent}
                    onChange={(e) => setKrCurrent(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hedef</label>
                  <input
                    type="number"
                    step="any"
                    value={krTarget}
                    onChange={(e) => setKrTarget(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ağırlık</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={krWeight}
                    onChange={(e) => setKrWeight(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKrModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">İlerleme Check-in</h2>
              <button
                type="button"
                onClick={() => setCiModalKr(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <div className="font-semibold">{ciModalKr.title}</div>
              <div className="text-slate-400 mt-1">
                Önceki: {ciModalKr.current_value} / Hedef: {ciModalKr.target_value}{' '}
                {ciModalKr.unit}
              </div>
            </div>

            <form onSubmit={handleSaveCheckIn} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Yeni Değer ({ciModalKr.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ciNewValue}
                  onChange={(e) => setCiNewValue(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Güven Durumu</label>
                <select
                  value={ciConfidence}
                  onChange={(e) => setCiConfidence(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  {Object.entries(OKR_CONFIDENCE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Check-in Notu</label>
                <textarea
                  rows={2}
                  value={ciNote}
                  onChange={(e) => setCiNote(e.target.value)}
                  placeholder="Bu hafta neler oldu, engel var mı?"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCiModalKr(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Check-in Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
