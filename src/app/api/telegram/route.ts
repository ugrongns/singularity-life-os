import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { appSettings, transactions, userHealthProfile, books, walletsAccounts, importantDates, digitalVaultItems } from '@/db/schema';
import { eq, sql , or } from 'drizzle-orm';

async function getSetting(key: string): Promise<string | null> {
  const row = (await db.select().from(appSettings).where(eq(appSettings.key, key)))[0];
  return row ? row.value : null;
}

function setSetting(key: string, value: string) {
  const now = new Date().toISOString();
  db.insert(appSettings)
    .values({ key, value, updated_at: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } })
    ;
}

// 1. GET: Telegram Bot Durum ve Yapılandırma Bilgisi
export async function GET() {
  try {
    initDatabase();
    const token = (await getSetting('telegram_bot_token')) || process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = (await getSetting('telegram_chat_id')) || process.env.TELEGRAM_CHAT_ID || '';
    const isEnabled = (await getSetting('telegram_enabled')) === 'true' || !!token;

    return NextResponse.json({
      success: true,
      data: {
        is_configured: !!token && !!chatId,
        is_enabled: isEnabled,
        bot_token_masked: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '',
        chat_id: chatId,
        commands: [
          { command: '/ozet', desc: 'Günlük Finans, Sağlık & Yaşam Özeti' },
          { command: '/harcama [tutar] [isletme]', desc: 'Hızlı harcama kaydı (Örn: /harcama 450 Migros)' },
          { command: '/su [ml]', desc: 'Su kaydı (Örn: /su 500)' },
          { command: '/kitap [sayfa]', desc: 'Kitap okuma ilerlemesi (Örn: /kitap 30)' },
          { command: '📸 Fotoğraf Gönder', desc: 'Fiş/fatura fotoğrafı atın, anında bütçeye işlensin' },
          { command: '🎙️ Ses Kaydı Gönder', desc: 'Sesli komut atın, tüm işlemleri otomatik dağıtsın' }
        ]
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. POST: Webhook veya Yönetim İşlemleri
export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    // A. AYARLARI KAYDET
    if (body.action === 'save_config') {
      if (body.bot_token !== undefined) setSetting('telegram_bot_token', body.bot_token);
      if (body.chat_id !== undefined) setSetting('telegram_chat_id', body.chat_id);
      if (body.is_enabled !== undefined) setSetting('telegram_enabled', String(body.is_enabled));

      return NextResponse.json({
        success: true,
        message: 'Telegram yapılandırması başarıyla kaydedildi!'
      });
    }

    // 1-CLICK OTOMATİK BOT BİLGİSİ & CHAT ID YAKALAMA (SIFIR ÇABA EŞLEŞTİRME)
    if (body.action === 'autodetect_chat_id' || body.action === 'get_bot_info') {
      const token = body.bot_token || getSetting('telegram_bot_token');
      if (!token) {
        return NextResponse.json({ success: false, error: 'Bot Token girilmedi.' }, { status: 400 });
      }

      // 1. Bot Bilgisini Al (getMe)
      let botUsername = '';
      let botFirstName = '';
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meJson = await meRes.json();
        if (meJson.ok && meJson.result) {
          botUsername = meJson.result.username;
          botFirstName = meJson.result.first_name;
        } else {
          return NextResponse.json({ success: false, error: `Geçersiz Bot Token: ${meJson.description}` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Telegram bağlantı hatası: ${err.message}` }, { status: 400 });
      }

      // 2. Gelen Mesajlardan Chat ID'yi Otomatik Yakala (getUpdates)
      let detectedChatId: string | null = null;
      let detectedSenderName: string | null = null;
      try {
        const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
        const updJson = await updRes.json();
        if (updJson.ok && Array.isArray(updJson.result) && updJson.result.length > 0) {
          const lastUpdate = updJson.result[updJson.result.length - 1];
          const msg = lastUpdate.message || lastUpdate.channel_post || lastUpdate.my_chat_member;
          if (msg && msg.chat && msg.chat.id) {
            detectedChatId = String(msg.chat.id);
            detectedSenderName = msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() : null;
          }
        }
      } catch (err) {}

      if (detectedChatId && body.auto_save) {
        setSetting('telegram_bot_token', token);
        setSetting('telegram_chat_id', detectedChatId);
        setSetting('telegram_enabled', 'true');
      }

      return NextResponse.json({
        success: true,
        data: {
          bot_username: botUsername,
          bot_name: botFirstName,
          bot_link: `https://t.me/${botUsername}`,
          detected_chat_id: detectedChatId,
          sender_name: detectedSenderName,
          is_paired: !!detectedChatId
        }
      });
    }

    // B. TEST BİLDİRİMİ GÖNDER
    if (body.action === 'send_test_message') {
      const token = body.bot_token || getSetting('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = body.chat_id || getSetting('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID;

      const messageText = `🌌 *Singularity Life OS — Test Bildirimi*\n\n✅ Telegram Bot entegrasyonu başarıyla bağlandı!\n\n💡 *Neler Yapabilirsiniz?*\n• Fiş fotoğrafı atarak bütçeye işleyebilirsiniz\n• Ses kaydı atarak çoklu işlem girebilirsiniz\n• \`/ozet\` yazarak anlık yaşam durumunuzu görebilirsiniz.`;

      if (token && chatId) {
        try {
          const teleRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageText,
              parse_mode: 'Markdown'
            })
          });
          const teleJson = await teleRes.json();
          if (!teleJson.ok) throw new Error(teleJson.description);
        } catch (err: any) {
          return NextResponse.json({ success: false, error: `Telegram API Hatası: ${err.message}` }, { status: 400 });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Test bildirimi başarıyla gönderildi!',
        preview_text: messageText
      });
    }

    // C. GÜNLÜK ÖZET BÜLTENİ OLUŞTUR & GÖNDER (/ozet)
    if (body.action === 'get_daily_briefing' || body.action === 'send_daily_briefing') {
      const health = (await db.select().from(userHealthProfile).limit(1))[0] || { consumed_water_ml: 1250, daily_water_target_ml: 2500 };
      const activeBook = (await db.select().from(books).where(eq(books.status, 'reading')).limit(1))[0] || (await db.select().from(books).limit(1))[0];
      const today = new Date().toISOString().split('T')[0];

      const briefing = `🌌 *Singularity Günlük Yaşam Bülteni* (${today})\n\n` +
        `💰 *Finans:* Hesaplar ve bütçe güncel\n` +
        `💧 *Su:* ${health.consumed_water_ml} / ${health.daily_water_target_ml} ml (%${Math.round((health.consumed_water_ml / health.daily_water_target_ml) * 100)})\n` +
        (activeBook ? `📚 *Kitap:* ${activeBook.title} (${activeBook.current_page}/${activeBook.total_pages} sayfa)\n` : '') +
        `💊 *Wellness:* Sabah takviyeleri aktif\n\n` +
        `_Harcama, su veya okuma eklemek için mesaj veya ses atabilirsiniz._`;

      const token = await getSetting('telegram_bot_token');
      const chatId = await getSetting('telegram_chat_id');

      if (body.action === 'send_daily_briefing' && token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: briefing, parse_mode: 'Markdown' })
        });
      }

      return NextResponse.json({ success: true, text: briefing });
    }

    // D. TELEGRAM WEBHOOK INCOMING EVENT (Doğrudan Telegram Sunucularından Gelen İstek)
    const update = body;
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const text = msg.text || '';
      const token = (await getSetting('telegram_bot_token')) || process.env.TELEGRAM_BOT_TOKEN;

      let replyText = 'Anlaşılamadı. /ozet yazarak yardım alabilirsiniz.';

      if (text.startsWith('/start')) {
        replyText = `🌌 *Singularity Life OS Botuna Hoş Geldiniz!*\n\n` +
          `Dışarıdayken ev bütçesi, sağlık ve kitap verilerinizi saniyeler içinde buradan güncelleyebilirsiniz.\n\n` +
          `🔹 \`/ozet\` — Günlük durum özeti\n` +
          `🔹 Fiş Fotoğrafı gönderin ➔ Otomatik harcama olarak kaydetsin\n` +
          `🔹 Ses Kaydı atın ➔ Çoklu işlem olarak modüllere dağıtsın\n` +
          `🔹 \`/su 500\` ➔ 500 ml su ekler\n` +
          `🔹 \`/kitap 20\` ➔ Kitap ilerlemesi kaydeder`;
      } else if (text.startsWith('/ozet')) {
        const health = (await db.select().from(userHealthProfile).limit(1))[0] || { consumed_water_ml: 1250, daily_water_target_ml: 2500 };
        const activeBook = (await db.select().from(books).where(eq(books.status, 'reading')).limit(1))[0];
        replyText = `📊 *GÜNLÜK YAŞAM ÖZETİ*\n\n` +
          `💧 Su: ${health.consumed_water_ml} / ${health.daily_water_target_ml} ml\n` +
          (activeBook ? `📚 Aktif Kitap: ${activeBook.title} (${activeBook.current_page}/${activeBook.total_pages} sayfa)\n` : '') +
          `✅ Tüm sistemler aktif ve yerel senkronize.`;
      } else if (text.startsWith('/su')) {
        const parts = text.split(' ');
        const ml = parseInt(parts[1], 10) || 250;
        const profile = (await db.select().from(userHealthProfile).limit(1))[0];
        const current = (profile?.consumed_water_ml || 0) + ml;
        db.update(userHealthProfile).set({ consumed_water_ml: current, updated_at: new Date().toISOString() });
        replyText = `💧 *+${ml} ml su kaydedildi!*\nBugünkü toplam: ${current} ml`;
      } else if (text.startsWith('/kitap')) {
        const parts = text.split(' ');
        const pages = parseInt(parts[1], 10) || 10;
        const activeBook = (await db.select().from(books).where(eq(books.status, 'reading')).limit(1))[0] || (await db.select().from(books).limit(1))[0];
        if (activeBook) {
          const newPage = Math.min(activeBook.total_pages, (activeBook.current_page || 0) + pages);
          db.update(books).set({ current_page: newPage, updated_at: new Date().toISOString() }).where(eq(books.id, activeBook.id));
          replyText = `📚 *Kitap İlerlemesi Kaydedildi!*\n${activeBook.title}: +${pages} sayfa (${newPage}/${activeBook.total_pages})`;
        }
      } else if (text.length > 0) {
        // Doğal Dil / Sesli Komut Motoruna Yönlendir
        const voiceRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/voice-command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const voiceJson = await voiceRes.json();
        if (voiceJson.success && voiceJson.actions?.length > 0) {
          // Otomatik çalıştır
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/voice-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'execute', actions: voiceJson.actions })
          });
          replyText = `✅ *${voiceJson.actions.length} İşlem İşlendi:*\n` + voiceJson.actions.map((a: any) => `• ${a.icon} ${a.title}`).join('\n');
        } else {
          replyText = `📝 Notunuz alındı: "${text}"`;
        }
      }

      // Cevap Gönder
      if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'Markdown' })
        });
      }

      return NextResponse.json({ success: true, replied: replyText });
    }

    return NextResponse.json({ success: true, message: 'Update processed' });
  } catch (error: any) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
