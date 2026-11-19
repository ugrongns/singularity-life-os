'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Calculator, TrendingDown } from 'lucide-react';
import { calculateLoanAmortization, TR_LOAN_TAX_MULTIPLIER } from '@/lib/debt-simulators';

interface LoanAccount {
  id: string;
  name: string;
  balance: number;
  loan_original_amount?: number;
  loan_total_repayment?: number;
  monthly_installment_amount?: number;
  total_installments?: number;
  interest_rate?: number;
}

interface LoanAmortizationModalProps {
  isOpen: boolean;
  account: LoanAccount | null;
  onClose: () => void;
}

export default function LoanAmortizationModal({ isOpen, account, onClose }: LoanAmortizationModalProps) {
  const [loanCategory, setLoanCategory] = useState<'consumer' | 'mortgage'>('consumer');
  const [customRate, setCustomRate] = useState<string>('');
  const [earlyMonth, setEarlyMonth] = useState<number>(3);

  useEffect(() => {
    if (account) {
      setCustomRate(account.interest_rate ? String(account.interest_rate) : '');
      const totalN = account.total_installments || 12;
      setEarlyMonth(Math.min(totalN, Math.max(1, Math.floor(totalN / 3))));
    }
  }, [account]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const result = useMemo(() => {
    if (!account) return null;
    const principal = Number(account.loan_original_amount || Math.abs(account.balance || 0));
    const totalInstallments = Number(account.total_installments || 12);
    const parsedCustom = customRate.trim() !== '' ? Number(customRate) : undefined;
    return calculateLoanAmortization({
      principal,
      totalInstallments,
      monthlyContractualRatePercent: Number.isFinite(parsedCustom) ? parsedCustom : undefined,
      knownMonthlyInstallment: account.monthly_installment_amount || undefined,
      taxMultiplier: loanCategory === 'consumer' ? TR_LOAN_TAX_MULTIPLIER : 1.0,
      earlyPayoffAfterMonth: earlyMonth
    });
  }, [account, customRate, loanCategory, earlyMonth]);

  if (!isOpen || !account || !result) return null;

  const formatTRY = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(v || 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '760px',
          width: '100%',
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Başlık */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-blue">
              <Calculator size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                📊 {account.name} — Fransız İtfa & Erken Kapama
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Anapara, faiz, KKDF/BSMV ve EYMO (Efektif Yıllık Maliyet Oranı) analizi
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Gövde */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Parametreler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Kredi Türü</label>
              <select
                value={loanCategory}
                onChange={e => setLoanCategory(e.target.value as 'consumer' | 'mortgage')}
                className="input"
                style={{ width: '100%', fontSize: '12px' }}
              >
                <option value="consumer">İhtiyaç / Taşıt (%15 KKDF + %15 BSMV)</option>
                <option value="mortgage">Konut Kredisi (Vergi Muaf)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Aylık Akdi Faiz (%) (Boş bırakılırsa taksitten bulunur)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={customRate}
                onChange={e => setCustomRate(e.target.value)}
                placeholder={`Tahmini: %${result.estimatedMonthlyContractualRatePercent}`}
                className="input"
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Erken Kapama Taksit Ayı ({earlyMonth}. Taksit Sonrası)
              </label>
              <input
                type="range"
                min={0}
                max={result.totalInstallments}
                value={earlyMonth}
                onChange={e => setEarlyMonth(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--emerald)' }}
              />
            </div>
          </div>

          {/* Özet Metrikler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Aylık Taksit</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)' }}>{formatTRY(result.monthlyInstallment)}</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>EYMO (Yıllık Efektif)</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#F59E0B' }}>%{result.effectiveAnnualCostRatePercent}</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{earlyMonth}. Taksitte Kalan Anapara</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#3B82F6' }}>{formatTRY(result.remainingPrincipalToPay)}</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              <div style={{ fontSize: '11px', color: '#10B981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingDown size={12} /> Erken Kapama Tasarrufu
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#10B981' }}>{formatTRY(result.savedInterestAndTax)}</div>
            </div>
          </div>

          {/* İtfa Tablosu */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', textAlign: 'right' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Taksit</th>
                  <th style={{ padding: '8px 10px' }}>Taksit Tutarı</th>
                  <th style={{ padding: '8px 10px' }}>Anapara</th>
                  <th style={{ padding: '8px 10px' }}>Faiz</th>
                  <th style={{ padding: '8px 10px' }}>KKDF+BSMV</th>
                  <th style={{ padding: '8px 10px' }}>Kalan Anapara</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map(row => {
                  const isEarlyMark = row.installmentNo === earlyMonth;
                  return (
                    <tr
                      key={row.installmentNo}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: isEarlyMark ? 'rgba(16, 185, 129, 0.09)' : 'transparent',
                        textAlign: 'right',
                        fontWeight: isEarlyMark ? 800 : 500
                      }}
                    >
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>{row.installmentNo}</td>
                      <td style={{ padding: '7px 10px' }}>{formatTRY(row.payment)}</td>
                      <td style={{ padding: '7px 10px', color: '#10B981' }}>{formatTRY(row.principal)}</td>
                      <td style={{ padding: '7px 10px', color: '#F59E0B' }}>{formatTRY(row.interest)}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{formatTRY(row.tax)}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700 }}>{formatTRY(row.remainingBalance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
