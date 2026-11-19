'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Target, Wallet, X } from 'lucide-react';
import { diffTurkeyCalendarDays, getTodayTurkeyDate } from '@/lib/date-utils';

export interface SinkingFundItem {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  icon?: string | null;
  color?: string | null;
  is_family_shared: number;
  user_id?: string | null;
}

interface SavingsGoalsCardProps {
  funds: SinkingFundItem[];
  accounts: Array<{ id: string; name: string; type: string; balance: number; currency: string }>;
  onUpdate: (msg?: string) => void;
}

const FUND_ICONS = ['🎯', '🏖️', '💻', '🚗', '🏠', '🎓', '💍', '🛡️', '📱'];
const FUND_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

export default function SavingsGoalsCard({ funds, accounts, onUpdate }: SavingsGoalsCardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#10B981');
  const [isFamilyShared, setIsFamilyShared] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Katkı (Para Ekle) Modal State
  const [contributeFund, setContributeFund] = useState<SinkingFundItem | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [contributing, setContributing] = useState(false);

  const eligibleWallets = accounts.filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'time_deposit');
  const todayTr = getTodayTurkeyDate();

  const formatTRY = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v || 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || Number(targetAmount) <= 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/budget/sinking-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: name.trim(),
          target_amount: Number(targetAmount),
          current_amount: Number(currentAmount || 0),
          target_date: targetDate || null,
          icon,
          color,
          is_family_shared: isFamilyShared ? 1 : 0
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsCreateOpen(false);
        setName('');
        setTargetAmount('');
        setCurrentAmount('');
        setTargetDate('');
        onUpdate(json.message);
      } else {
        onUpdate(json.error || 'Hedef eklenemedi.');
      }
    } catch {
      onUpdate('Hedef eklenirken hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeFund || !contributeAmount || Number(contributeAmount) === 0 || contributing) return;
    setContributing(true);
    try {
      const res = await fetch('/api/budget/sinking-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contribute',
          id: contributeFund.id,
          amount: Number(contributeAmount),
          wallet_id: selectedWalletId || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setContributeFund(null);
        setContributeAmount('');
        setSelectedWalletId('');
        onUpdate(json.message);
      } else {
        onUpdate(json.error || 'Katkı eklenemedi.');
      }
    } catch {
      onUpdate('İşlem sırasında hata oluştu.');
    } finally {
      setContributing(false);
    }
  };

  const handleDelete = async (fund: SinkingFundItem) => {
    if (!confirm(`"${fund.name}" birikim hedefini silmek istiyor musunuz?`)) return;
    try {
      const res = await fetch('/api/budget/sinking-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: fund.id })
      });
      const json = await res.json();
      onUpdate(json.message || json.error);
    } catch {
      onUpdate('Hedef silinirken hata oluştu.');
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} style={{ color: '#10B981' }} />
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              🎯 Birikim Hedefleri (Sinking Funds)
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Kişisel veya aile hedefleriniz için adım adım birikim takibi
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary"
          style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '7px 12px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Plus size={14} />
          <span>Yeni Hedef</span>
        </button>
      </div>

      {funds.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
            background: 'var(--surface-subtle)',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}
        >
          Henüz birikim hedefi eklenmedi. Tatil, acil durum fonu veya yeni cihaz hedefi oluşturabilirsiniz.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px'
          }}
        >
          {funds.map(fund => {
            const pct = fund.target_amount > 0 ? Math.min(100, Math.round((fund.current_amount / fund.target_amount) * 100)) : 0;
            const remaining = Math.max(0, fund.target_amount - fund.current_amount);
            const daysLeft = fund.target_date ? diffTurkeyCalendarDays(fund.target_date, todayTr) : null;
            const accent = fund.color || '#10B981';
            const dailyNeeded = daysLeft && daysLeft > 0 && remaining > 0 ? Math.ceil(remaining / daysLeft) : null;

            return (
              <div
                key={fund.id}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '20px' }}>{fund.icon || '🎯'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fund.name}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {fund.is_family_shared === 1 ? '👨‍👩‍👧 Aile Ortak' : '🔒 Kişisel'}
                        {fund.target_date ? ` • Hedef: ${fund.target_date}` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(fund)}
                    aria-label={`${fund.name} hedefini sil`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, marginBottom: '5px' }}>
                    <span style={{ color: accent }}>{formatTRY(fund.current_amount)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>/ {formatTRY(fund.target_amount)} (%{pct})</span>
                  </div>
                  <div style={{ width: '100%', height: '7px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {remaining <= 0
                      ? '🎉 Hedef tamamlandı!'
                      : dailyNeeded
                        ? `Günde ~${formatTRY(dailyNeeded)} (${daysLeft} gün)`
                        : `Kalan: ${formatTRY(remaining)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setContributeFund(fund);
                      setContributeAmount('');
                      setSelectedWalletId('');
                    }}
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: '7px',
                      border: `1px solid ${accent}`,
                      background: 'var(--surface)',
                      color: accent,
                      cursor: 'pointer'
                    }}
                  >
                    + Para Ekle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Yeni Hedef Modal */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)} style={{ zIndex: 1100 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>🎯 Yeni Birikim Hedefi</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="modal-close-btn" aria-label="Kapat">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hedef Adı</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Örn. Acil Durum Fonu, Yaz Tatili" className="input" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hedef Tutar (₺)</label>
                  <input type="number" required min="1" step="any" inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="50000" className="input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Başlangıç (₺)</label>
                  <input type="number" min="0" step="any" inputMode="decimal" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} placeholder="0" className="input" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hedef Tarih (İsteğe Bağlı)</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>İkon & Renk</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {FUND_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)} style={{ padding: '4px 8px', borderRadius: '6px', border: icon === ic ? '2px solid var(--emerald)' : '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer', fontSize: '16px' }}>
                      {ic}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {FUND_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Renk ${c}`} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text-main)' : '1px solid var(--border)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={isFamilyShared} onChange={e => setIsFamilyShared(e.target.checked)} />
                <span>Aile ile paylaşılan ortak hedef olsun</span>
              </label>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px', fontWeight: 800 }}>
                {submitting ? 'Kaydediliyor...' : 'Hedefi Oluştur'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Para Ekle / Katkı Modalı */}
      {contributeFund && (
        <div className="modal-overlay" onClick={() => setContributeFund(null)} style={{ zIndex: 1100 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                {contributeFund.icon || '🎯'} {contributeFund.name} — Katkı Ekle
              </h3>
              <button type="button" onClick={() => setContributeFund(null)} className="modal-close-btn" aria-label="Kapat">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleContribute} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Eklenecek Tutar (₺) (Çekmek için eksi değer yazabilirsiniz)
                </label>
                <input
                  type="number"
                  required
                  step="any"
                  inputMode="decimal"
                  value={contributeAmount}
                  onChange={e => setContributeAmount(e.target.value)}
                  placeholder="Örn. 2500"
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <Wallet size={12} /> Cüzdan Bağlantısı (İsteğe Bağlı)
                </label>
                <select
                  value={selectedWalletId}
                  onChange={e => setSelectedWalletId(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="">Sadece hedef ilerlemesini artır (Hesaptan düşme)</option>
                  {eligibleWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({Number(w.balance || 0).toLocaleString('tr-TR')} {w.currency}) — Bakiyeden düş
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={contributing} className="btn-primary" style={{ padding: '10px', fontWeight: 800 }}>
                {contributing ? 'İşleniyor...' : 'Birikime Aktar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
