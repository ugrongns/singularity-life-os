'use client';
import { useState, useEffect, useRef } from 'react';

export default function TelegramBotCard() {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [botHint, setBotHint] = useState<{ username: string; link: string } | null>(null);
  const detectTimeoutRef = useRef<any>(null);

  const isChatIdInvalid = chatId.trim().length > 0 && !/^-?\d+$/.test(chatId.trim());

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
    return () => {
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
    };
  }, []);

  const runAutoDetect = async (tokenOverride?: string, autoSave = false) => {
    setDetecting(true);
    setBotHint(null);
    setStatusMsg({ text: '🔍 Bot taranıyor ve Chat ID aranıyor...', type: 'success' });
    try {
      const payload: Record<string, any> = {
        action: 'autodetect_chat_id',
        auto_save: autoSave
      };
      if (tokenOverride && tokenOverride.trim()) {
        payload.bot_token = tokenOverride.trim();
      }

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.detected_chat_id) {
          setChatId(json.data.detected_chat_id);
          if (autoSave) {
            setIsConfigured(true);
            setIsEnabled(true);
          }
          setStatusMsg({
            text: autoSave
              ? `✅ @${json.data.bot_username} üzerinden Chat ID (${json.data.detected_chat_id}) otomatik bulundu ve kaydedildi!`
              : `✅ @${json.data.bot_username} botu ve Chat ID (${json.data.detected_chat_id}) otomatik bağlandı!`,
            type: 'success'
          });
        } else {
          setBotHint(
            json.data.bot_username
              ? { username: json.data.bot_username, link: json.data.bot_link || `https://t.me/${json.data.bot_username}` }
              : null
          );
          setStatusMsg({
            text: `⚠️ @${json.data.bot_username} botuna henüz mesaj atılmamış. Lütfen Telegram'da botu açıp "/start" yazın ve tekrar "🔍 Otomatik Bul" butonuna basın.`,
            type: 'error'
          });
        }
      } else {
        setStatusMsg({ text: `❌ Hata: ${json.error || 'Bot bilgisi alınamadı.'}`, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: `❌ Hata: ${err.message}`, type: 'error' });
    } finally {
      setDetecting(false);
    }
  };

  const handleAutoDetectChatId = () => {
    runAutoDetect(botToken, true);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    setBotHint(null);
    try {
      const payload: Record<string, any> = {
        action: 'save_config',
        chat_id: chatId.trim(),
        is_enabled: isEnabled,
        auto_setup_webhook: true
      };
      if (botToken.trim()) payload.bot_token = botToken.trim();
      if (secretToken.trim()) payload.secret_token = secretToken.trim();

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        const resolvedChatId = json.data?.chat_id || chatId.trim();
        if (json.data?.chat_id) setChatId(json.data.chat_id);
        setStatusMsg({
          text: `✅ ${json.message || 'Telegram yapılandırması ve Webhook başarıyla kaydedildi!'}`,
          type: 'success'
        });
        setIsConfigured(Boolean(resolvedChatId && /^-?\d+$/.test(resolvedChatId)));
        if (resolvedChatId && /^-?\d+$/.test(resolvedChatId)) setIsEnabled(true);
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
    setStatusMsg(null);
    setBotHint(null);
    if (isChatIdInvalid) {
      setStatusMsg({
        text: '❌ Chat ID sadece rakamlardan oluşmalıdır (Örn: 123456789). Bot adını değil, Telegram kullanıcı ID numaranızı girin veya "🔍 Otomatik Bul" butonuna tıklayın.',
        type: 'error'
      });
      return;
    }

    setTesting(true);
    try {
      const payload: Record<string, any> = {
        action: 'send_test_message',
        chat_id: chatId.trim()
      };
      if (botToken.trim()) payload.bot_token = botToken.trim();

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
    if (!simInput.trim() || simulating) return;
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (!chatId.trim()) {
      setSimMessages(prev => [
        ...prev,
        { sender: 'bot', text: '⚠️ Simülatörü kullanmak için önce yukarıdan Chat ID girin veya "🔍 Otomatik Bul" butonunu kullanın.', time: nowTime }
      ]);
      return;
    }
    const userText = simInput.trim();

    setSimMessages(prev => [...prev, { sender: 'user', text: userText, time: nowTime }]);
    setSimInput('');
    setSimulating(true);

    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secretToken ? { 'x-telegram-bot-api-secret-token': secretToken } : {})
        },
        body: JSON.stringify({
          message: {
            text: userText,
            chat: { id: chatId.trim() }
          }
        })
      });
      const json = await res.json();
      const botReply = json.replied || 'İşleminiz kaydedildi.';
      setSimMessages(prev => [...prev, { sender: 'bot', text: botReply, time: nowTime }]);
    } catch (err) {
      setSimMessages(prev => [...prev, { sender: 'bot', text: 'İşlem işlenirken hata oluştu.', time: nowTime }]);
    } finally {
      setSimulating(false);
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
            onChange={(e) => {
              const val = e.target.value;
              setBotToken(val);
              if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
              if (val.length > 20 && val.includes(':')) {
                detectTimeoutRef.current = setTimeout(() => {
                  runAutoDetect(val, false);
                }, 600);
              }
            }}
            style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>CHAT ID (Otomatik Dolan veya Numaranız):</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="Otomatik algılanır veya 123456789"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: '13px',
                border: `1px solid ${isChatIdInvalid ? 'var(--rose)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)'
              }}
            />
            <button
              type="button"
              onClick={handleAutoDetectChatId}
              disabled={detecting || saving || loading}
              className="btn-subtle"
              style={{
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                whiteSpace: 'nowrap',
                background: 'var(--surface)',
                color: 'var(--text-main)'
              }}
            >
              {detecting ? 'Aranıyor...' : '🔍 Otomatik Bul'}
            </button>
          </div>
          {isChatIdInvalid && (
            <div style={{ fontSize: '11px', color: 'var(--rose)', marginTop: '4px', fontWeight: 600 }}>
              ⚠️ Chat ID bot adı değil, sayısal numaranız olmalıdır (Örn: 123456789). Telegram'dan bota /start yazıp "🔍 Otomatik Bul" butonuna basın.
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>WEBHOOK SECRET TOKEN (X-Telegram-Bot-Api-Secret-Token):</label>
          <input
            type="password"
            placeholder="Boş bırakırsanız otomatik oluşturulur ve bağlanır"
            value={secretToken}
            onChange={e => setSecretToken(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={handleSave}
            disabled={saving || detecting || loading}
            className="btn-primary"
            style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
          >
            {saving ? 'Kaydediliyor...' : '💾 Ayarları Kaydet'}
          </button>
          <button
            onClick={handleTestNotification}
            disabled={testing || saving || detecting || loading}
            className="btn-subtle"
            style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)' }}
          >
            {testing ? 'Gönderiliyor...' : '🔔 Test Bildirimi'}
          </button>
        </div>

        {statusMsg && (
          <div style={{
            fontSize: '12px', padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: statusMsg.type === 'success' ? 'var(--emerald-bg)' : 'var(--rose-bg)',
            color: statusMsg.type === 'success' ? 'var(--emerald)' : 'var(--rose)',
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span>{statusMsg.text}</span>
            {botHint && (
              <a
                href={botHint.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700, width: 'fit-content' }}
              >
                Telegram'da @{botHint.username} botunu aç (/start gönder) ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* Telegram Canlı Bot Simülatörü */}
      <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>💬 Telegram Bot Canlı Test Simülatörü</div>
          <span style={{ fontSize: '10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
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
                background: m.sender === 'user' ? 'var(--emerald)' : 'var(--surface)',
                color: m.sender === 'user' ? '#FFFFFF' : 'var(--text-main)',
                border: m.sender === 'user' ? 'none' : '1px solid var(--border)',
                padding: '8px 12px', borderRadius: '12px',
                maxWidth: '85%', fontSize: '12px', lineHeight: '1.4',
                boxShadow: 'var(--shadow-sm)',
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
            style={{ flex: 1, padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text-main)' }}
          />
          <button
            onClick={handleSimulateMessage}
            disabled={simulating || !simInput.trim()}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
          >
            {simulating ? '...' : 'Gönder ➔'}
          </button>
        </div>
      </div>
    </div>
  );
}
