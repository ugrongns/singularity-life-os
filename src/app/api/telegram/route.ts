import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { appSettings, transactions, userHealthProfile, books, walletsAccounts, importantDates, digitalVaultItems } from '@/db/schema';
import { eq, sql , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

async function getSetting(key: string): Promise<string | null> {
  const row = (await db.select().from(appSettings).where(eq(appSettings.key, key)))[0];
  return row ? row.value : null;
}

async function setSetting(key: string, value: string) {
  const now = new Date().toISOString();
  await db.insert(appSettings)
    .values({ key, value, updated_at: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } });
}

// 1. GET: Telegram Bot Durum ve Yapılandırma Bilgisi (Sadece Oturum Açmış Kullanıcı)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

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
    const body = await req.json().catch(() => ({}));

    // A. AYARLARI KAYDET (Oturum zorunlu)
    if (body.action === 'save_config') {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
      }

      if (body.bot_token !== undefined) await setSetting('telegram_bot_token', body.bot_token);
      if (body.chat_id !== undefined) await setSetting('telegram_chat_id', body.chat_id);
      if (body.secret_token !== undefined) await setSetting('telegram_secret_token', body.secret_token);
      if (body.is_enabled !== undefined) await setSetting('telegram_enabled', String(body.is_enabled));

      return NextResponse.json({
        success: true,
        message: 'Telegram yapılandırması başarıyla kaydedildi!'
      });
    }

    // 1-CLICK OTOMATİK BOT BİLGİSİ & CHAT ID YAKALAMA (Oturum zorunlu)
    if (body.action === 'autodetect_chat_id' || body.action === 'get_bot_info') {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
      }

      const token = body.bot_token || await getSetting('telegram_bot_token');
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
        await setSetting('telegram_bot_token', token);
        await setSetting('telegram_chat_id', detectedChatId);
        await setSetting('telegram_enabled', 'true');
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

    // B. TEST BİLDİRİMİ GÖNDER (Oturum zorunlu)
    if (body.action === 'send_test_message') {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
      }

      const token = body.bot_token || (await getSetting('telegram_bot_token')) || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = body.chat_id || (await getSetting('telegram_chat_id')) || process.env.TELEGRAM_CHAT_ID;

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

    // C. GÜNLÜK ÖZET BÜLTENİ OLUŞTUR & GÖNDER (/ozet - Oturum zorunlu)
    if (body.action === 'get_daily_briefing' || body.action === 'send_daily_briefing') {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
      }

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
    // 1. Secret Token Doğrulaması (X-Telegram-Bot-Api-Secret-Token)
    const configuredSecret = (await getSetting('telegram_secret_token')) || process.env.TELEGRAM_SECRET_TOKEN;
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (configuredSecret && incomingSecret !== configuredSecret) {
      console.warn('[Telegram Webhook] Geçersiz Secret Token reddedildi.');
      return NextResponse.json({ success: false, error: 'Unauthorized webhook' }, { status: 403 });
    }

    const update = body;
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const text = msg.text || '';
      const token = (await getSetting('telegram_bot_token')) || process.env.TELEGRAM_BOT_TOKEN;
      const registeredChatId = (await getSetting('telegram_chat_id')) || process.env.TELEGRAM_CHAT_ID;

      // 2. Chat ID Doğrulaması: Yalnızca kayıtlı olan eşleşmiş kullanıcı komut çalıştırabilir
      if (registeredChatId && String(chatId) !== String(registeredChatId)) {
        console.warn(`[Telegram Webhook] Yetkisiz chat_id reddedildi: ${chatId}`);
        if (token && chatId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: '⛔ Bu bot sadece yetkili Singularity Life OS hesabına bağlıdır.' })
          });
        }
        return NextResponse.json({ success: false, error: 'Unauthorized Chat ID' }, { status: 403 });
      }

      let replyText = 'Anlaşılamadı. /ozet yazarak yardım alabilirsiniz.';

      if (text.startsWith('/start')) {
        replyText = `🌌 *Singularity Life OS Botuna Hoş Geldiniz!*\n\n` +
          `Dışarıdayken ev bütçesi, sağlık ve kitap verilerinizi saniyeler içinde buradan güncelleyebilirsiniz.\n\n` +
          `🔹 \`/ozet\` — Günlük durum özeti\n` +
          `🔹 Fiş Fotoğrafı gönderin ➔ Otomatik harcama taslağı oluşturur\n` +
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
        await db.update(userHealthProfile).set({ consumed_water_ml: current, updated_at: new Date().toISOString() });
        replyText = `💧 *+${ml} ml su kaydedildi!*\nBugünkü toplam: ${current} ml`;
      } else if (text.startsWith('/kitap')) {
        const parts = text.split(' ');
        const pages = parseInt(parts[1], 10) || 10;
        const activeBook = (await db.select().from(books).where(eq(books.status, 'reading')).limit(1))[0] || (await db.select().from(books).limit(1))[0];
        if (activeBook) {
          const newPage = Math.min(activeBook.total_pages, (activeBook.current_page || 0) + pages);
          await db.update(books).set({ current_page: newPage, updated_at: new Date().toISOString() }).where(eq(books.id, activeBook.id));
          replyText = `📚 *Kitap İlerlemesi Kaydedildi!*\n${activeBook.title}: +${pages} sayfa (${newPage}/${activeBook.total_pages})`;
        }
      } else if (text.length > 0) {
        // Doğal Dil / Sesli Komut Motoruna Taslak Hazırlat
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const internalKey = process.env.INTERNAL_SERVICE_KEY || '';
        try {
          const voiceRes = await fetch(`${baseUrl}/api/voice-command`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Service-Key': internalKey
            },
            body: JSON.stringify({ text })
          });
          const voiceJson = await voiceRes.json();
          if (voiceJson.success && voiceJson.actions?.length > 0) {
            // Eşleşmiş yetkili kullanıcı ise güvenli işle
            await fetch(`${baseUrl}/api/voice-command`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Key': internalKey
              },
              body: JSON.stringify({ action: 'execute', actions: voiceJson.actions })
            });
            replyText = `✅ *${voiceJson.actions.length} İşlem İşlendi:*\n` + voiceJson.actions.map((a: any) => `• ${a.icon} ${a.title}`).join('\n');
          } else {
            replyText = `📝 Notunuz alındı: "${text}"`;
          }
        } catch (err: any) {
          replyText = `⚠️ Komut işlenirken bir hata oluştu: ${err.message}`;
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
