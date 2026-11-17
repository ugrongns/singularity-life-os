'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Repeat,
  Flame,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import {
  TaskItem,
  CrossModuleAction,
  TaskCalendarDay,
  PILLAR_CONFIGS,
  buildTaskCalendarMonth
} from '@/lib/tasks-engine';
import { formatTurkishDisplayDate } from '@/lib/date-utils';

interface TaskCalendarPanelProps {
  tasks: TaskItem[];
  crossModuleActions: CrossModuleAction[];
  todayStr: string;
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
  onAddTaskForDate: (dateStr: string) => void;
  onImportCrossModule: (action: CrossModuleAction) => void;
  onClose: () => void;
}

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function TaskCalendarPanel({
  tasks,
  crossModuleActions,
  todayStr,
  selectedDate,
  onSelectDate,
  onAddTaskForDate,
  onImportCrossModule,
  onClose
}: TaskCalendarPanelProps) {
  const initialAnchor = selectedDate || todayStr;
  const [viewYear, setViewYear] = useState<number>(() => Number(initialAnchor.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState<number>(() => Number(initialAnchor.slice(5, 7)) - 1);

  const calendarDays: TaskCalendarDay[] = useMemo(
    () => buildTaskCalendarMonth(viewYear, viewMonth, tasks, crossModuleActions, todayStr),
    [viewYear, viewMonth, tasks, crossModuleActions, todayStr]
  );

  const selectedDayData = useMemo(
    () => (selectedDate ? calendarDays.find(d => d.dateStr === selectedDate) || null : null),
    [calendarDays, selectedDate]
  );

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(Number(todayStr.slice(0, 4)));
    setViewMonth(Number(todayStr.slice(5, 7)) - 1);
    onSelectDate(todayStr);
  };

  const handleDayClick = (day: TaskCalendarDay) => {
    if (!day.isCurrentMonth) {
      setViewYear(Number(day.dateStr.slice(0, 4)));
      setViewMonth(Number(day.dateStr.slice(5, 7)) - 1);
    }
    onSelectDate(selectedDate === day.dateStr ? null : day.dateStr);
  };

  const isViewingTodayMonth =
    viewYear === Number(todayStr.slice(0, 4)) && viewMonth === Number(todayStr.slice(5, 7)) - 1;

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid var(--border)',
        background: 'var(--surface)'
      }}
    >
      {/* Üst Kontrol Çubuğu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 900, color: 'var(--text-main)' }}>
            <Calendar size={16} color="#F59E0B" />
            <span>{MONTH_NAMES_TR[viewMonth]} {viewYear}</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Önceki ay"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={goToToday}
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: '6px',
                border: `1px solid ${isViewingTodayMonth && selectedDate === todayStr ? '#F59E0B' : 'var(--border)'}`,
                background: isViewingTodayMonth && selectedDate === todayStr ? 'rgba(245, 158, 11, 0.14)' : 'var(--surface-subtle)',
                color: isViewingTodayMonth && selectedDate === todayStr ? '#F59E0B' : 'var(--text-main)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Sonraki ay"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Lejant + Kapat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B' }} /> MIT
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444' }} /> Gecikmiş
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} /> Tamam
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#06B6D4' }} /> Rutin
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EC4899' }} /> Köprü
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Takvimi kapat"
            style={{
              height: '28px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface-subtle)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <X size={13} />
            <span>Kapat</span>
          </button>
        </div>
      </div>

      {/* Hafta Başlıkları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
        {WEEKDAY_LABELS.map(day => (
          <div
            key={day}
            style={{
              textAlign: 'center',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--text-muted)',
              paddingBottom: '2px'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 7 Sütunlu Aylık Gün Izgarası */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
        {calendarDays.map(day => {
          const isSelected = selectedDate === day.dateStr;
          const allDoneDay = day.totalTasks > 0 && day.pendingCount === 0;
          const hasActivity = day.totalTasks > 0 || day.virtualRecurrences.length > 0 || day.bridgeActions.length > 0;

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => handleDayClick(day)}
              aria-pressed={isSelected}
              title={`${day.dateStr}${day.totalTasks > 0 ? ` • ${day.totalTasks} görev` : ''}${day.virtualRecurrences.length > 0 ? ` • ${day.virtualRecurrences.length} planlı rutin` : ''}${day.bridgeActions.length > 0 ? ` • ${day.bridgeActions.length} sistem uyarısı` : ''}`}
              style={{
                minHeight: '48px',
                padding: '5px 6px',
                borderRadius: '8px',
                border: isSelected
                  ? '1.5px solid #3B82F6'
                  : day.isToday
                    ? '1.5px solid #F59E0B'
                    : '1px solid var(--border)',
                background: isSelected
                  ? 'rgba(59, 130, 246, 0.12)'
                  : day.isToday
                    ? 'rgba(245, 158, 11, 0.08)'
                    : day.isCurrentMonth
                      ? 'var(--surface-subtle)'
                      : 'transparent',
                opacity: day.isCurrentMonth ? 1 : 0.42,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'stretch',
                gap: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: day.isToday || isSelected ? 900 : 700,
                    color: isSelected ? '#3B82F6' : day.isToday ? '#F59E0B' : 'var(--text-main)',
                    lineHeight: 1
                  }}
                >
                  {day.dayNumber}
                </span>

                {day.totalTasks > 0 && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: '999px',
                      background: allDoneDay
                        ? 'rgba(16, 185, 129, 0.16)'
                        : day.overdueCount > 0
                          ? 'rgba(239, 68, 68, 0.16)'
                          : 'var(--surface)',
                      color: allDoneDay
                        ? '#10B981'
                        : day.overdueCount > 0
                          ? '#EF4444'
                          : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      lineHeight: 1.2
                    }}
                  >
                    {day.pendingCount > 0 ? day.pendingCount : `✓${day.completedCount}`}
                  </span>
                )}
              </div>

              {/* Durum Noktaları */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minHeight: '8px', flexWrap: 'wrap' }}>
                {day.mitCount > 0 && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} title="MIT Odak" />
                )}
                {day.overdueCount > 0 && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} title="Gecikmiş görev" />
                )}
                {day.pendingCount > 0 && day.mitCount === 0 && day.overdueCount === 0 && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6' }} title="Açık görev" />
                )}
                {allDoneDay && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} title="Tüm görevler tamam" />
                )}
                {day.virtualRecurrences.length > 0 && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06B6D4' }} title="Planlı rutin önizlemesi" />
                )}
                {day.bridgeActions.length > 0 && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EC4899' }} title="Sistem köprüsü hatırlatıcısı" />
                )}
                {!hasActivity && <span style={{ width: '1px', height: '6px', opacity: 0 }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Seçili Gün Detay & Hızlı Aksiyon Şeridi */}
      {selectedDate && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-main)' }}>
                📅 {formatTurkishDisplayDate(selectedDate, true)}
              </span>
              {selectedDayData && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedDayData.totalTasks} görev
                  {selectedDayData.virtualRecurrences.length > 0 ? ` • ${selectedDayData.virtualRecurrences.length} planlı rutin` : ''}
                  {selectedDayData.bridgeActions.length > 0 ? ` • ${selectedDayData.bridgeActions.length} sistem uyarısı` : ''}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onAddTaskForDate(selectedDate)}
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  background: 'rgba(59, 130, 246, 0.14)',
                  color: '#3B82F6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={13} />
                <span>Bu Güne Görev Ekle</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(null)}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
                <span>Seçimi Temizle</span>
              </button>
            </div>
          </div>

          {/* Seçili Günün Sistem Köprüsü Hatırlatıcıları */}
          {selectedDayData && selectedDayData.bridgeActions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDayData.bridgeActions.map(action => (
                <div
                  key={action.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px dashed rgba(236, 72, 153, 0.35)',
                    background: 'rgba(236, 72, 153, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: '1 1 200px' }}>
                    <AlertTriangle size={13} color={action.priority === 'critical' ? '#EF4444' : '#F59E0B'} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {action.title}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {action.subtitle}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImportCrossModule(action)}
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: '1px solid rgba(236, 72, 153, 0.35)',
                      background: 'var(--surface)',
                      color: '#EC4899',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📥 Göreve Aktar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Seçili Günün Sanal Tekrarlayan Rutin Önizlemeleri */}
          {selectedDayData && selectedDayData.virtualRecurrences.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#06B6D4', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Repeat size={11} />
                <span>PLANLI RUTİN ÖNİZLEMESİ (Mevcut rutin tamamlanınca otomatik oluşur)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedDayData.virtualRecurrences.map(vr => {
                  const pillarCfg = PILLAR_CONFIGS[vr.pillar] || PILLAR_CONFIGS.general;
                  const recLabel = vr.recurrence === 'daily' ? 'Günlük' : vr.recurrence === 'weekly' ? 'Haftalık' : 'Aylık';
                  return (
                    <div
                      key={vr.id}
                      style={{
                        fontSize: '11px',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        border: '1px dashed rgba(6, 182, 212, 0.4)',
                        background: 'rgba(6, 182, 212, 0.06)',
                        color: 'var(--text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }}
                    >
                      <span>{pillarCfg.icon}</span>
                      <span>{vr.title}</span>
                      {vr.due_time && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({vr.due_time})</span>
                      )}
                      {vr.is_mit === 1 && <Flame size={11} color="#F59E0B" />}
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.16)', color: '#06B6D4', fontWeight: 800 }}>
                        {recLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDayData &&
            selectedDayData.totalTasks === 0 &&
            selectedDayData.virtualRecurrences.length === 0 &&
            selectedDayData.bridgeActions.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle2 size={13} color="var(--text-muted)" />
                <span>Bu tarihte kayıtlı görev veya rutin bulunmuyor.</span>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
