'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
}

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  accounts?: Account[];
}

export default function AddAssetModal({ isOpen, onClose, onSuccess, accounts = [] }: AddAssetModalProps) {
  const [assetType, setAssetType] = useState<'bist_stock' | 'us_stock' | 'gold_metal' | 'crypto' | 'stablecoin' | 'cash_fiat' | 'bes'>('bist_stock');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [invAccounts, setInvAccounts] = useState<Account[]>(accounts);

  // Yerel Tarih-Saat Varsayılanı (YYYY-MM-DDTHH:mm)
  const getNowLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const [transactionDateTime, setTransactionDateTime] = useState(getNowLocalDateTime());

  // Normal Varlık Alanları
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('TRY');

  // BES Alanları
  const [company, setCompany] = useState('Anadolu Hayat Emeklilik');
  const [contractNo, setContractNo] = useState('');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('2500');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/budget')
        .then(r => r.json())
        .then(j => {
          if (j.success && j.data?.accounts) {
            setInvAccounts(j.data.accounts);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (type: any) => {
    setAssetType(type);
    if (type === 'us_stock' || type === 'crypto' || type === 'stablecoin') {
      setCurrency('USD');
    } else {
      setCurrency('TRY');
    }

    if (type === 'cash_fiat') {
      setSymbol('TRY');
      setName('Nakit Bakiye');
      setAvgCost('1');
      setCurrentPrice('1');
    } else if (type === 'stablecoin') {
      setSymbol('USDT');
      setName('Tether USDT');
      setAvgCost('1');
      setCurrentPrice('1');
    }
  };

  const handleApplyPreset = (s: string, n: string, cost: string, price: string) => {
    setSymbol(s);
    setName(n);
    setAvgCost(cost);
    setCurrentPrice(price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (assetType === 'bes') {
        const res = await fetch('/api/investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'bes',
            company,
            contract_no: contractNo,
            start_date: transactionDateTime,
            total_principal: parseFloat(totalPrincipal) || 0,
            monthly_payment: parseFloat(monthlyPayment) || 0
          })
        });
        const json = await res.json();
        if (json.success) {
          onSuccess(json.message);
          onClose();
        } else {
          alert(json.error || 'Eklenemedi.');
        }
      } else {
        const res = await fetch('/api/investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'asset',
            account_id: selectedAccountId || null,
            symbol,
            name,
            asset_class: assetType,
            quantity: parseFloat(quantity),
            avg_cost: parseFloat(avgCost) || (assetType === 'cash_fiat' ? 1 : 0),
            cost_currency: currency,
            current_price: parseFloat(currentPrice) || parseFloat(avgCost) || (assetType === 'cash_fiat' ? 1 : 0),
            current_price_currency: currency,
            purchase_date: transactionDateTime
          })
        });
        const json = await res.json();
        if (json.success) {
          onSuccess(json.message);
          onClose();
        } else {
          alert(json.error || 'Eklenemedi.');
        }
      }
    } catch (err) {
      alert('İşlem başarısız.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableAccounts = invAccounts.filter(a => ['brokerage', 'crypto_exchange', 'crypto_wallet', 'bank', 'cash'].includes(a.type));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '17px', fontWeight: 800 }}>📈 Portföye Yeni Varlık / Nakit Ekle</div>

        {/* Varlık Türü Seçici */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Varlık Sınıfı Seçin:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              className={`choice-pill ${assetType === 'bist_stock' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('bist_stock')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              🇹🇷 BIST Hisse
            </button>
            <button
              type="button"
              className={`choice-pill ${assetType === 'us_stock' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('us_stock')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              🇺🇸 ABD Hisse
            </button>
            <button
              type="button"
              className={`choice-pill ${assetType === 'gold_metal' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('gold_metal')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              🥇 Altın / Emtia
            </button>

            <button
              type="button"
              className={`choice-pill ${assetType === 'crypto' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('crypto')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              ₿ Kripto Varlık
            </button>

            <button
              type="button"
              className={`choice-pill ${assetType === 'stablecoin' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('stablecoin')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              💵 Stablecoin
            </button>

            <button
              type="button"
              className={`choice-pill ${assetType === 'cash_fiat' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('cash_fiat')}
              style={{ padding: '8px 4px', fontSize: '12px' }}
            >
              💰 Hesaptaki Nakit
            </button>

            <button
              type="button"
              className={`choice-pill ${assetType === 'bes' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('bes')}
              style={{ padding: '8px 4px', fontSize: '12px', gridColumn: 'span 3' }}
            >
              🛡️ BES Sözleşmesi
            </button>
          </div>
        </div>

        {/* Hangi Yatırım Hesabında? */}
        {assetType !== 'bes' && (
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              🏦 Hangi Hesaba / Borsaya Ait? (İsteğe Bağlı):
            </label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
            >
              <option value="">— Belirtilmedi (Bağımsız Varlık) —</option>
              {availableAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.type === 'brokerage' ? '📈' : a.type === 'crypto_exchange' ? '🔐' : a.type === 'crypto_wallet' ? '🦊' : '🏦'} {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tarih ve Saat Girişi */}
        <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>📅 Alış / İşlem Tarihi ve Saati:</label>
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setTransactionDateTime(getNowLocalDateTime())}
              style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--emerald)' }}
            >
              🕒 Şu Anı Seç
            </button>
          </div>
          <input
            type="datetime-local"
            value={transactionDateTime}
            onChange={e => setTransactionDateTime(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' }}
          />
        </div>

        {/* Hızlı Örnek Seçenekleri */}
        {assetType === 'bist_stock' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Örnek:</span>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('EREGL.IS', 'Ereğli Demir Çelik', '48.50', '52.10')}>
              EREGL.IS
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('FROTO.IS', 'Ford Otomotiv', '980.00', '1045.00')}>
              FROTO.IS
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('ASELS.IS', 'Aselsan', '56.00', '62.40')}>
              ASELS.IS
            </button>
          </div>
        )}

        {assetType === 'us_stock' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Örnek:</span>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('NVDA', 'NVIDIA Corporation', '118.00', '132.50')}>
              NVDA
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('TSLA', 'Tesla Inc.', '210.00', '224.00')}>
              TSLA
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('MSFT', 'Microsoft', '410.00', '435.00')}>
              MSFT
            </button>
          </div>
        )}

        {assetType === 'crypto' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Örnek:</span>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('ETH', 'Ethereum', '2800.00', '3150.00')}>
              ETH
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => handleApplyPreset('SOL', 'Solana', '135.00', '162.00')}>
              SOL
            </button>
          </div>
        )}

        {assetType === 'cash_fiat' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Örnek:</span>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => { setCurrency('TRY'); setSymbol('TRY'); setName('TL Nakit Bakiye'); }}>
              ₺ TL Nakit
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => { setCurrency('USD'); setSymbol('USD'); setName('Dolar Nakit Bakiye'); }}>
              $ USD Nakit
            </button>
            <button type="button" className="btn-subtle" style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px' }} onClick={() => { setCurrency('EUR'); setSymbol('EUR'); setName('Euro Nakit Bakiye'); }}>
              € EUR Nakit
            </button>
          </div>
        )}

        {/* Form Alanları */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {assetType === 'bes' ? (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Emeklilik Şirketi:</label>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Katılımcı Ana Parası (TL):</label>
                  <input
                    type="number"
                    placeholder="Örn: 100000"
                    value={totalPrincipal}
                    onChange={e => setTotalPrincipal(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Aylık Katkı Payı (TL):</label>
                  <input
                    type="number"
                    value={monthlyPayment}
                    onChange={e => setMonthlyPayment(e.target.value)}
                    style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                  />
                </div>
              </div>

              {totalPrincipal && (
                <div style={{ background: 'var(--emerald-bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--emerald)', fontWeight: 600 }}>
                  ✓ %30 Devlet Katkısı (+{(parseFloat(totalPrincipal) * 0.30).toLocaleString('tr-TR')} TL) otomatik hesaplanarak eklenecektir!
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Sembol / Kod:</label>
                  <input
                    type="text"
                    placeholder={assetType === 'cash_fiat' ? 'Örn: TRY' : 'Örn: EREGL.IS'}
                    value={symbol}
                    onChange={e => setSymbol(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Varlık / Adı:</label>
                  <input
                    type="text"
                    placeholder={assetType === 'cash_fiat' ? 'Örn: Boşta Nakit Bakiye' : 'Örn: Ereğli Demir Çelik'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                  />
                </div>
              </div>

              {assetType === 'cash_fiat' || assetType === 'stablecoin' ? (
                /* Nakit / Stablecoin için Sadeleştirilmiş 2 Kolonlu Görünüm */
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Nakit Miktarı ({currency}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Örn: 15000"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px', fontSize: '15px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Para Birimi:</label>
                    <select
                      value={currency}
                      onChange={e => {
                        const newCurr = e.target.value;
                        setCurrency(newCurr);
                        if (assetType === 'cash_fiat') {
                          setSymbol(newCurr);
                        }
                      }}
                      style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'var(--surface)' }}
                    >
                      <option value="TRY">₺ TRY</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* Hisse / Kripto / Emtia için Detaylı 3 Kolonlu Görünüm */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Adet / Miktar:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Örn: 250"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Birim Maliyet ({currency}):</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={avgCost}
                      onChange={e => setAvgCost(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Para Birimi:</label>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'var(--surface)' }}
                    >
                      <option value="TRY">₺ TRY</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ marginTop: '6px' }}>
            {isSubmitting ? 'Kaydediliyor...' : '✅ Varlığı Portföye Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
