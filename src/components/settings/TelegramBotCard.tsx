'use client';
import { useState, useEffect } from 'react';

export default function TelegramBotCard() {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simülatör State
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🌌 Singularity Life OS Telegram Asistanına Hoş Geldiniz!\n\n/ozet yazabilir veya "Migros\'ta 350 TL harcadım", "500 ml su içtim" şeklinde mesaj atabilirsiniz.',
      time: '08:00'
    }
  ]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/telegram');
      const json = await res.json();
      if (json.success && json.data) {
        setChatId(json.data.chat_id || '');
        setIsConfigured(json.data.is_configured);
        setIsEnabled(json.data.is_enabled);
      }
    } catch (err) {
      console.warn('Telegram fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          bot_token: botToken,
          chat_id: chatId,
          is_enabled: isEnabled
        })
      });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: '✅ Telegram ayarları başarıyla kaydedildi!', type: 'success' });
        setIsConfigured(!!chatId);
      } else {
        setStatusMsg({ text: `❌ Hata: ${json.error}`, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: `❌ Hata: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_test_message',
          bot_token: botToken,
          chat_id: chatId
        })
      });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: '🔔 ' + json.message, type: 'success' });
      } else {
        setStatusMsg({ text: `❌ Telegram Hatası: ${json.error}`, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: `❌ Hata: ${err.message}`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleSimulateMessage = async () => {
    if (!simInput.trim()) return;
    const userText = simInput.trim();
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    setSimMessages(prev => [...prev, { sender: 'user', text: userText, time: nowTime }]);
    setSimInput('');

    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: userText,
            chat: { id: chatId || 123456789 }
          }
        })
      });
      const json = await res.json();
      const botReply = json.replied || 'İşleminiz kaydedildi.';
      setSimMessages(prev => [...prev, { sender: 'bot', text: botReply, time: nowTime }]);
    } catch (err) {
      setSimMessages(prev => [...prev, { sender: 'bot', text: 'İşlem işlenirken hata oluştu.', time: nowTime }]);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🤖</span>
          <span>Telegram Bot Asistanı</span>
        </div>
      </div>
      <div className="card-action-bar">
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-full)',
          background: isConfigured ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
          color: isConfigured ? 'var(--emerald)' : 'var(--text-muted)'
        }}>
          {isConfigured ? '● Bağlı & Aktif' : '○ Yapılandırılmadı'}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.5' }}>
        Dışarıdayken Telegram üzerinden fotoğraf, ses kaydı veya hızlı komut atarak ev bütçesi, su ve kitap okuma verilerinizi anında kaydedin.
      </p>

      {/* Yapılandırma Formu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>BOT TOKEN (BotFather'dan Alınan):</label>
          <input
            type="password"
            placeholder="Örn: 7123456789:AAFlkB_..."
            value={botToken}
            onChange={async (e) => {
              const val = e.target.value;
              setBotToken(val);
              if (val.length > 20 && val.includes(':')) {
                setStatusMsg({ text: '🔍 Bot taranıyor ve Chat ID aranıyor...', type: 'success' });
                try {
                  const res = await fetch('/api/telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'autodetect_chat_id', bot_token: val, auto_save: false })
                  });
                  const json = await res.json();
                  if (json.success && json.data) {
                    if (json.data.detected_chat_id) {
                      setChatId(json.data.detected_chat_id);
                      setStatusMsg({ text: `✅ @${json.data.bot_username} botu ve Chat ID (${json.data.detected_chat_id}) otomatik bağlandı!`, type: 'success' });
                    } else {
                      setStatusMsg({ text: `🤖 Bot @${json.data.bot_username} bulundu! Telegram'da bota bir kez "Başlat" deyin.`, type: 'success' });
                    }
                  }
                } catch (err) {}
              }
            }}
            style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>CHAT ID (Otomatik Dolan veya Numaranız):</label>
          <input
            type="text"
            placeholder="Otomatik algılanır veya 123456789"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
          >
            {saving ? 'Kaydediliyor...' : '💾 Ayarları Kaydet'}
          </button>
          <button
            onClick={handleTestNotification}
            disabled={testing}
            className="btn-subtle"
            style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)' }}
          >
            {testing ? 'Gönderiliyor...' : '🔔 Test Bildirimi'}
          </button>
        </div>

        {statusMsg && (
          <div style={{
            fontSize: '12px', padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: statusMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: statusMsg.type === 'success' ? '#065F46' : '#991B1B',
            fontWeight: 600
          }}>
            {statusMsg.text}
          </div>
        )}
      </div>

      {/* Telegram Canlı Bot Simülatörü */}
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534' }}>💬 Telegram Bot Canlı Test Simülatörü</div>
          <span style={{ fontSize: '10px', background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
            İnteraktif
          </span>
        </div>

        {/* Mesaj Akışı */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '10px', paddingRight: '4px' }}>
          {simMessages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                background: m.sender === 'user' ? '#10B981' : 'white',
                color: m.sender === 'user' ? 'white' : 'var(--text-main)',
                padding: '8px 12px', borderRadius: '12px',
                maxWidth: '85%', fontSize: '12px', lineHeight: '1.4',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                whiteSpace: 'pre-line'
              }}
            >
              <div>{m.text}</div>
              <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '2px', opacity: 0.75 }}>{m.time}</div>
            </div>
          ))}
        </div>

        {/* Simülatör Giriş */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Örn: /ozet veya 500 ml su içtim..."
            value={simInput}
            onChange={e => setSimInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSimulateMessage()}
            style={{ flex: 1, padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'white' }}
          />
          <button
            onClick={handleSimulateMessage}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
          >
            Gönder ➔
          </button>
        </div>
      </div>
    </div>
  );
}
