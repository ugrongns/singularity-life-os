'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  credit_limit?: number;
}

interface Category {
  id: string;
  name: string;
  type?: string;
  icon?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSuccess: (msg?: string) => void;
}

export default function ManualExpenseModal({ isOpen, onClose, accounts, categories, onSuccess }: Props) {
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [installments, setInstallments] = useState('1');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Kategori Listesi Filtresi (Harcama vs Gelir)
  const filteredCategories = categories.filter(c => {
    if (txType === 'income') return c.type === 'income' || c.name.toLowerCase().includes('gelir') || c.name.toLowerCase().includes('maaş');
    return c.type !== 'income' && !c.name.toLowerCase().includes('gelir') && !c.name.toLowerCase().includes('maaş');
  });

  const [fetchedAccounts, setFetchedAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (isOpen && accounts.length === 0) {
      fetch('/api/budget')
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data?.accounts) {
            setFetchedAccounts(json.data.accounts);
          }
        });
    }
  }, [isOpen, accounts.length]);

  const activeAccounts = accounts.length > 0 ? accounts : fetchedAccounts;

  useEffect(() => {
    if (activeAccounts.length > 0 && !walletId) setWalletId(activeAccounts[0].id);
    setServerError(null);
  }, [activeAccounts, isOpen]);

  // Sekme değiştiğinde ilk uygun kategoriyi seç
  useEffect(() => {
    if (filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [txType]);

  if (!isOpen) return null;

  const selectedWallet = activeAccounts.find(a => a.id === walletId);
  const numAmount = Number(amount) || 0;

  // Canlı Limit Kontrolü (SADECE Harcama/Gider Durumunda Yapılır)
  let limitError: string | null = null;
  if (txType === 'expense' && selectedWallet && numAmount > 0) {
    if (selectedWallet.type === 'credit_card') {
      const avail = Math.max(0, (selectedWallet.credit_limit || 0) - selectedWallet.balance);
      if (numAmount > avail) {
        limitError = `⚠️ Kredi Kartı Limiti Aşıldı! ${selectedWallet.name} kullanılabilir limiti: ${avail.toLocaleString('tr-TR')} ₺`;
      }
    } else {
      if (numAmount > selectedWallet.balance) {
        limitError = `⚠️ Yetersiz Bakiye! ${selectedWallet.name} kullanılabilir nakit: ${selectedWallet.balance.toLocaleString('tr-TR')} ₺`;
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !walletId) return;
    if (txType === 'expense' && limitError) {
      setServerError(limitError);
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType,
          wallet_id: walletId,
          category_id: categoryId || undefined,
          merchant: merchant || (txType === 'income' ? 'Gelir Girişi' : 'Harcama'),
          amount: parseFloat(amount),
          installments: txType === 'expense' ? parseInt(installments, 10) : 1
        })
      });

      const json = await res.json();
      if (json.success) {
        setAmount('');
        setMerchant('');
        onSuccess(json.message);
        onClose();
      } else {
        setServerError(json.error || 'İşlem kaydedilemedi.');
      }
    } catch (err) {
      setServerError('Sunucu hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"></div>

        {/* Gider vs Gelir Sekme Değiştirici */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            onClick={() => setTxType('expense')}
            style={{
              flex: 1, padding: '8px', fontSize: '13px', fontWeight: 800, borderRadius: '6px', border: 'none',
              background: txType === 'expense' ? '#EF4444' : 'transparent',
              color: txType === 'expense' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            🔴 Harcama (Gider)
          </button>

          <button
            type="button"
            onClick={() => setTxType('income')}
            style={{
              flex: 1, padding: '8px', fontSize: '13px', fontWeight: 800, borderRadius: '6px', border: 'none',
              background: txType === 'income' ? '#10B981' : 'transparent',
              color: txType === 'income' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            🟢 Gelir Ekle (Maaş/Kira/Diğer)
          </button>
        </div>

        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: txType === 'income' ? '#059669' : '#DC2626' }}>
          {txType === 'income' ? '💰 Hesabınıza Gelir Ekleyin' : '➕ Harcama Kaydı Girin'}
        </div>

        {(serverError || (txType === 'expense' && limitError)) && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
            {limitError || serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tutar (TL) *</label>
            <input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="tabular-nums"
              style={{
                width: '100%', padding: '12px', fontSize: '20px', fontWeight: 800,
                border: (txType === 'expense' && limitError) ? '2px solid #EF4444' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', marginTop: '4px',
                color: (txType === 'expense' && limitError) ? '#DC2626' : txType === 'income' ? '#059669' : 'var(--text-main)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {txType === 'income' ? 'Gelir Kaynağı / Açıklama:' : 'Mağaza / Açıklama:'}
            </label>
            <input 
              type="text" 
              placeholder={txType === 'income' ? "Örn: Ağustos Maaşı, Kadıköy Ev Kirası" : "Örn: Migros, Shell, Fatura"} 
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {txType === 'income' ? 'Paranın Yattığı Hesap *' : 'Hesap *'}
              </label>
              <select 
                value={walletId} 
                onChange={e => setWalletId(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
              >
                {activeAccounts.map(acc => {
                  const avail = acc.type === 'credit_card'
                    ? Math.max(0, (acc.credit_limit || 0) - acc.balance)
                    : acc.balance;
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === 'credit_card' ? '💳' : '🏦'} {acc.name} {txType === 'expense' ? `(Kalan: ${avail.toLocaleString('tr-TR')} ₺)` : `(Bakiye: ${acc.balance.toLocaleString('tr-TR')} ₺)`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Kategori:</label>
              <select 
                value={categoryId} 
                onChange={e => setCategoryId(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
              >
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon || '🏷️'} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {txType === 'expense' && selectedWallet?.type === 'credit_card' && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Taksit Sayısı:</label>
              <select 
                value={installments} 
                onChange={e => setInstallments(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
              >
                <option value="1">Tek Çekim (Taksitsiz)</option>
                <option value="2">2 Taksit</option>
                <option value="3">3 Taksit</option>
                <option value="6">6 Taksit</option>
                <option value="9">9 Taksit</option>
                <option value="12">12 Taksit</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              type="button" 
              onClick={onClose}
              className="btn-subtle" 
              style={{ flex: 1, padding: '12px' }}
            >
              İptal
            </button>
            <button 
              type="submit" 
              disabled={loading || (txType === 'expense' && Boolean(limitError))}
              className={txType === 'income' ? 'btn-emerald' : 'btn-primary'} 
              style={{
                flex: 2, padding: '12px',
                background: txType === 'income' ? '#10B981' : undefined,
                color: txType === 'income' ? 'white' : undefined,
                border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 800,
                opacity: (txType === 'expense' && Boolean(limitError)) ? 0.5 : 1,
                cursor: (txType === 'expense' && Boolean(limitError)) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Kaydediliyor...' : txType === 'income' ? '🟢 Geliri Kaydet' : '🔴 Harcamayı Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
