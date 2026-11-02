'use client';

import React, { useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  Sparkles,
  Check,
  Droplets,
  Pill,
  ArrowRight
} from 'lucide-react';
import {
  getTodayTurkeyDate,
  shiftTurkeyDate,
  formatTurkishDisplayDate,
  getShortTurkishDayName,
  parseTurkeyDate,
  getDaysRangeTurkey
} from '@/lib/date-utils';

export interface CalendarDayStatus {
  date: string;
  isToday: boolean;
  waterAmount: number;
  waterGoal: number;
  isWaterMet: boolean;
  supplementsTaken: number;
  supplementsTotal: number;
  isSupplementsMet: boolean;
  hasMood: boolean;
  moodScore: number | null;
  hasSleep: boolean;
  sleepHours: number | null;
  allCompleted: boolean;
}

interface DailyTrackerCalendarBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  calendarHistory?: CalendarDayStatus[];
  onResetDay?: () => void;
  isResetting?: boolean;
}

export default function DailyTrackerCalendarBar({
  selectedDate,
  onSelectDate,
  calendarHistory = [],
  onResetDay,
  isResetting = false
}: DailyTrackerCalendarBarProps) {
  const selectedDayRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const today = getTodayTurkeyDate();
  const isToday = selectedDate === today;

  useEffect(() => {
    if (selectedDayRef.current) {
      selectedDayRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [selectedDate]);

  const daysToRender: CalendarDayStatus[] = (calendarHistory && calendarHistory.length > 0)
    ? calendarHistory
    : getDaysRangeTurkey(14).map(d => ({
        date: d,
        isToday: d === today,
        waterAmount: 0,
        waterGoal: 2500,
        isWaterMet: false,
        supplementsTaken: 0,
        supplementsTotal: 0,
        isSupplementsMet: false,
        hasMood: false,
        moodScore: null,
        hasSleep: false,
        sleepHours: null,
        allCompleted: false
      }));

  const handlePrevDay = () => {
    onSelectDate(shiftTurkeyDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (!isToday) {
      onSelectDate(shiftTurkeyDate(selectedDate, 1));
    }
  };

  const handleConfirmReset = () => {
    if (!onResetDay) return;
    const ok = window.confirm('Bugünkü takviye, su, uyku ve ruh hali kayıtlarınızı sıfırlamak istediğinize emin misiniz?');
    if (ok) {
      onResetDay();
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      {/* 1. Üst Navigasyon & Tarih Seçici Çubuğu */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Sol Segment: Tarih Gezinimi & Hızlı Gün Seçimi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Önceki Gün Butonu */}
          <button
            type="button"
            onClick={handlePrevDay}
            className="btn-subtle"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
            title="Önceki Gün"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Merkez Tarih Hapı (Tıklanınca Doğrudan Native Date Picker Açar) */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '8px',
                backgroundColor: isToday ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-subtle)',
                color: isToday ? '#6366F1' : 'var(--text-main)',
                border: isToday ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border)',
                transition: 'all 0.15s ease',
                pointerEvents: 'none'
              }}
            >
              <Calendar size={15} color={isToday ? '#6366F1' : 'var(--text-muted)'} />
              <span>{formatTurkishDisplayDate(selectedDate)}</span>
              {isToday && (
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: '#6366F1',
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontWeight: 900
                  }}
                >
                  Bugün
                </span>
              )}
            </div>

            {/* Şeffaf Doğrudan Tıklanabilir Native Date Input */}
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 5
              }}
              aria-label="Takvimden Tarih Seç"
              title="Takvimden Tarih Seç"
            />
          </div>

          {/* Sonraki Gün Butonu (Bugünse devre dışı) */}
          <button
            type="button"
            onClick={handleNextDay}
            disabled={isToday}
            className="btn-subtle"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              cursor: isToday ? 'not-allowed' : 'pointer',
              opacity: isToday ? 0.35 : 1
            }}
            title="Sonraki Gün"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Sağ Segment: Bugüne Dön & Sıfırla Eylemleri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isToday ? (
            <button
              type="button"
              onClick={() => onSelectDate(today)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={14} />
              <span>Bugüne Dön</span>
            </button>
          ) : (
            onResetDay && (
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-subtle)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  cursor: isResetting ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Bugünkü takviye, su, uyku ve ruh hali kayıtlarını sıfırla"
              >
                <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
                <span>{isResetting ? 'Sıfırlanıyor...' : 'Bugünü Sıfırla'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Son 14 Günlük İnteraktif Takvim Şeridi (Horizontal Day Strip) */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar"
      >
        {daysToRender.map((day) => {
          const isSelected = day.date === selectedDate;
          const parsed = parseTurkeyDate(day.date);
          const dayNum = parsed.getUTCDate();
          const dayShort = getShortTurkishDayName(day.date);

          return (
            <button
              key={day.date}
              ref={isSelected ? selectedDayRef : undefined}
              type="button"
              onClick={() => onSelectDate(day.date)}
              style={{
                flex: '0 0 auto',
                minWidth: '46px',
                padding: '8px 4px 6px',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid #6366F1'
                  : '1px solid var(--border)',
                backgroundColor: isSelected
                  ? 'rgba(99, 102, 241, 0.16)'
                  : day.isToday
                  ? 'rgba(99, 102, 241, 0.06)'
                  : 'var(--surface-subtle)',
                boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title={`${formatTurkishDisplayDate(day.date)} (${day.supplementsTaken}/${day.supplementsTotal} Takviye, ${day.waterAmount} ml Su)`}
            >
              {/* Gün Adı */}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: isSelected ? '#6366F1' : 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}
              >
                {dayShort}
              </span>

              {/* Gün Numarası */}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 900,
                  color: isSelected ? 'var(--text-main)' : 'var(--text-main)',
                  lineHeight: 1
                }}
              >
                {dayNum}
              </span>

              {/* Tamamlanma Rozet Noktaları */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                {/* Takviye Durumu (Mor / Gri) */}
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: day.supplementsTaken > 0 ? '#8B5CF6' : 'rgba(255,255,255,0.15)',
                    display: 'inline-block'
                  }}
                  title={`Takviye: ${day.supplementsTaken}/${day.supplementsTotal}`}
                />

                {/* Su Durumu (Mavi / Gri) */}
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: day.waterAmount > 0 ? '#06B6D4' : 'rgba(255,255,255,0.15)',
                    display: 'inline-block'
                  }}
                  title={`Su: ${day.waterAmount} ml`}
                />

                {/* Tüm Görevler Tamamsa Zümrüt Yıldız */}
                {day.allCompleted && (
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      display: 'inline-block'
                    }}
                    title="Tüm Hedefler Başarıyla Tamamlandı!"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Geçmiş Gün İnceleme Uyarı Şeridi */}
      {!isToday && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#D97706'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📜</span>
            <span>
              <strong>Geçmiş Gün Kaydı:</strong> {formatTurkishDisplayDate(selectedDate)} tarihindeki takviye, su ve sağlık kayıtlarını görüntülüyorsunuz.
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectDate(today)}
            style={{
              background: 'none',
              border: 'none',
              color: '#D97706',
              fontWeight: 800,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'underline'
            }}
          >
            <span>Bugüne Dön</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
