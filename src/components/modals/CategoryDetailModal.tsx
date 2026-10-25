'use client';
import { useState, useEffect } from 'react';
import { Tag, X, Trash2, Calendar } from 'lucide-react';

interface CategoryDetailModalProps {
  isOpen: boolean;
  categoryId: string | null;
  categoryName?: string;
  monthStr: string;
  onClose: () => void;
  onUpdate: (msg?: string) => void;
}

export default function CategoryDetailModal({
  isOpen,
  categoryId,
  categoryName,
  monthStr,
  onClose,
  onUpdate
}: CategoryDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

  const fetchCategoryDetails = async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/category-details?category_id=${categoryId}&month=${monthStr}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Fetch category details error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && categoryId) {
      fetchCategoryDetails();
    }
  }, [isOpen, categoryId, monthStr]);

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !categoryId) return null;

  const handleDeleteTx = async (txId: string, merchant: string) => {
    if (!confirm(`"${merchant}" harcama kaydını silmek ve tutarı bakiye iadesi olarak hesaba aktarmak istediğinize emin misiniz?`)) return;

    setDeletingId(txId);
    try {
      const res = await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchCategoryDetails();
        onUpdate(json.message);
      } else {
        alert(json.error || 'Silme işlemi başarısız.');
      }
    } catch {
      alert('Sunucu hatası.');
    } finally {
      setDeletingId(null);
    }
  };

  const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date(monthStr + '-01'));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-amber">
              <Tag size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {data?.category?.name || categoryName || 'Kategori Harcamaları'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {monthName} ayı için yapılmış tüm harcama ve taksit kalemleri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Bütçe İlerleme Özeti */}
        {data && (
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
              <span className="tabular-nums">Bu Ayki Harcama: {formatMoney(data.totalSpent)}</span>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>Bütçe Limiti: {formatMoney(data.monthlyBudgetLimit)}</span>
            </div>
            <div className="budget-bar-track" style={{ height: '8px' }}>
              <div
                className="budget-bar-fill"
                style={{
                  width: `${Math.min(100, Math.round((data.totalSpent / (data.monthlyBudgetLimit || 1)) * 100))}%`,
                  backgroundColor: (data.totalSpent > data.monthlyBudgetLimit && data.monthlyBudgetLimit > 0) ? '#EF4444' : '#10B981'
                }}
              />
            </div>
          </div>
        )}

        {/* İşlemler Listesi */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px', minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              İşlemler yükleniyor...
            </div>
          ) : data?.transactions?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛒</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Bu kategoride bu ay henüz harcama yok.</div>
            </div>
          ) : (
            data?.transactions?.map((tx: any) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {tx.merchant || 'Harcama'}
                    {tx.is_installment === 1 && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        Taksit {tx.installment_number}/{tx.total_installments}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} strokeWidth={1.75} />
                    <span>{tx.transaction_date} • {tx.wallet_name} {tx.notes ? `• ${tx.notes}` : ''}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 900, color: '#DC2626' }}>
                    -{formatMoney(tx.amount)}
                  </div>
                  <button
                    onClick={() => handleDeleteTx(tx.id, tx.merchant)}
                    disabled={deletingId === tx.id}
                    title="Harcamayı Sil ve Bakiyeyi İade Et"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      opacity: 0.6, padding: '4px', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sabit Alt Buton */}
        <div className="modal-sticky-footer">
          <button
            onClick={onClose}
            className="btn-subtle"
            style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, minHeight: '44px' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
