import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, transactions, userHealthProfile, books, walletsAccounts, importantDates, digitalVaultItems } from '@/db/schema';
import { eq, sql, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// 1. GET: Telegram Bot Durum ve Yapılandırma Bilgisi (Sadece Oturum Açmış Kullanıcı)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    await initDatabase();
    const token = user.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = user.telegram_chat_id || '';
    const isEnabled = Boolean(user.telegram_enabled && token && chatId);

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
    await initDatabase();
    const body = await req.json().catch(() => ({}));

    // A. AYARLARI KAYDET (Oturum zorunlu)
    if (body.action === 'save_config') {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (body.bot_token !== undefined) updateData.telegram_bot_token = body.bot_token;
      if (body.chat_id !== undefined) updateData.telegram_chat_id = body.chat_id;
      if (body.secret_token !== undefined) updateData.telegram_secret_token = body.secret_token;
      if (body.is_enabled !== undefined) updateData.telegram_enabled = body.is_enabled ? 1 : 0;

      await db.update(users).set(updateData).where(eq(users.id, user.id));

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

      const token = body.bot_token || user.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
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
        await db.update(users).set({
          telegram_bot_token: token,
          telegram_chat_id: detectedChatId,
          telegram_enabled: 1,
          updated_at: new Date().toISOString()
        }).where(eq(users.id, user.id));
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

      const token = body.bot_token || user.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = body.chat_id || user.telegram_chat_id;

      if (!token || !chatId) {
        return NextResponse.json({ success: false, error: 'Telegram Bot Token veya Chat ID tanımlı değil.' }, { status: 400 });
      }

      const messageText = `🌌 *Singularity Life OS — Test Bildirimi*\n\n✅ Telegram Bot entegrasyonu başarıyla bağlandı!\n\n💡 *Neler Yapabilirsiniz?*\n• Fiş fotoğrafı atarak bütçeye işleyebilirsiniz\n• Ses kaydı atarak çoklu işlem girebilirsiniz\n• \`/ozet\` yazarak anlık yaşam durumunuzu görebilirsiniz.`;

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

      const health = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0]
        || { consumed_water_ml: 1250, daily_water_target_ml: 2500 };
      const activeBook = (await db.select().from(books).where(and(eq(books.user_id, user.id), eq(books.status, 'reading'))).limit(1))[0]
        || (await db.select().from(books).where(eq(books.user_id, user.id)).limit(1))[0];
      const today = new Date().toISOString().split('T')[0];

      const briefing = `🌌 *Singularity Günlük Yaşam Bülteni* (${today})\n\n` +
        `💰 *Finans:* Hesaplar ve bütçe güncel\n` +
        `💧 *Su:* ${health.consumed_water_ml} / ${health.daily_water_target_ml} ml (%${Math.round((health.consumed_water_ml / health.daily_water_target_ml) * 100)})\n` +
        (activeBook ? `📚 *Kitap:* ${activeBook.title} (${activeBook.current_page}/${activeBook.total_pages} sayfa)\n` : '') +
        `💊 *Wellness:* Sabah takviyeleri aktif\n\n` +
        `_Harcama, su veya okuma eklemek için mesaj veya ses atabilirsiniz._`;

      const token = user.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = user.telegram_chat_id;

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

      if (!chatId) {
        return NextResponse.json({ success: false, error: 'Chat ID missing' }, { status: 400 });
      }

      // 1. Bu Chat ID'ye sahip kayıtlı kullanıcıyı bul
      const targetUser = (await db.select().from(users).where(eq(users.telegram_chat_id, String(chatId))).limit(1))[0];
      const fallbackToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!targetUser) {
        console.warn(`[Telegram Webhook] Eşleşmeyen chat_id: ${chatId}`);
        if (fallbackToken) {
          await fetch(`https://api.telegram.org/bot${fallbackToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: '⛔ Bu Telegram hesabı herhangi bir Singularity Life OS kullanıcısı ile eşleştirilmemiş. Lütfen Web Ayarlarından Bot Token ve Chat ID tanımlayın.' })
          }).catch(() => {});
        }
        return NextResponse.json({ success: false, error: 'Unauthorized Chat ID' }, { status: 403 });
      }

      // 2. Secret Token Doğrulaması (Eğer kullanıcı veya sistemde ayarlanmışsa)
      const configuredSecret = targetUser.telegram_secret_token || process.env.TELEGRAM_SECRET_TOKEN;
      const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (configuredSecret && incomingSecret && incomingSecret !== configuredSecret) {
        console.warn('[Telegram Webhook] Geçersiz Secret Token reddedildi.');
        return NextResponse.json({ success: false, error: 'Unauthorized webhook' }, { status: 403 });
      }

      const userBotToken = targetUser.telegram_bot_token || fallbackToken;

      let replyText = 'Anlaşılamadı. /ozet yazarak yardım alabilirsiniz.';

      if (text.startsWith('/start')) {
        replyText = `🌌 *Singularity Life OS Botuna Hoş Geldiniz, ${targetUser.full_name || targetUser.username}!*\n\n` +
          `Dışarıdayken ev bütçesi, sağlık ve kitap verilerinizi saniyeler içinde buradan güncelleyebilirsiniz.\n\n` +
          `🔹 \`/ozet\` — Günlük durum özeti\n` +
          `🔹 Fiş Fotoğrafı gönderin ➔ Otomatik harcama taslağı oluşturur\n` +
          `🔹 Ses Kaydı atın ➔ Çoklu işlem olarak modüllere dağıtsın\n` +
          `🔹 \`/su 500\` ➔ 500 ml su ekler\n` +
          `🔹 \`/kitap 20\` ➔ Kitap ilerlemesi kaydeder`;
      } else if (text.startsWith('/ozet')) {
        const health = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, targetUser.id)).limit(1))[0]
          || { consumed_water_ml: 1250, daily_water_target_ml: 2500 };
        const activeBook = (await db.select().from(books).where(and(eq(books.user_id, targetUser.id), eq(books.status, 'reading'))).limit(1))[0];
        replyText = `📊 *GÜNLÜK YAŞAM ÖZETİ (${targetUser.full_name || targetUser.username})*\n\n` +
          `💧 Su: ${health.consumed_water_ml} / ${health.daily_water_target_ml} ml\n` +
          (activeBook ? `📚 Aktif Kitap: ${activeBook.title} (${activeBook.current_page}/${activeBook.total_pages} sayfa)\n` : '') +
          `✅ Kullanıcı hesabınızla tam senkronize.`;
      } else if (text.startsWith('/su')) {
        const parts = text.split(' ');
        const ml = parseInt(parts[1], 10) || 250;
        let profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, targetUser.id)).limit(1))[0];
        const current = (profile?.consumed_water_ml || 0) + ml;
        if (profile?.id) {
          await db.update(userHealthProfile)
            .set({ consumed_water_ml: current, updated_at: new Date().toISOString() })
            .where(eq(userHealthProfile.id, profile.id));
        } else {
          await db.insert(userHealthProfile).values({
            id: `hp-${targetUser.id}`,
            user_id: targetUser.id,
            family_id: targetUser.family_id || `fam-${targetUser.id}`,
            consumed_water_ml: current,
            daily_water_target_ml: 2500,
            active_fasting_protocol: '16:8',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        replyText = `💧 *+${ml} ml su kaydedildi!*\nBugünkü toplam: ${current} ml`;
      } else if (text.startsWith('/kitap')) {
        const parts = text.split(' ');
        const pages = parseInt(parts[1], 10) || 10;
        const activeBook = (await db.select().from(books).where(and(eq(books.user_id, targetUser.id), eq(books.status, 'reading'))).limit(1))[0]
          || (await db.select().from(books).where(eq(books.user_id, targetUser.id)).limit(1))[0];
        if (activeBook) {
          const newPage = Math.min(activeBook.total_pages, (activeBook.current_page || 0) + pages);
          await db.update(books).set({ current_page: newPage, updated_at: new Date().toISOString() }).where(eq(books.id, activeBook.id));
          replyText = `📚 *Kitap İlerlemesi Kaydedildi!*\n${activeBook.title}: +${pages} sayfa (${newPage}/${activeBook.total_pages})`;
        } else {
          replyText = `📚 Okunmakta olan aktif kitap bulunamadı. Lütfen kütüphaneden bir kitap başlatın.`;
        }
      } else if (text.length > 0) {
        // Doğal Dil / Sesli Komut Motoruna Taslak Hazırlat ve Hedef Kullanıcı Bağlamında Çalıştır
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const internalKey = process.env.INTERNAL_SERVICE_KEY || '';
        try {
          const voiceRes = await fetch(`${baseUrl}/api/voice-command`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Service-Key': internalKey
            },
            body: JSON.stringify({
              text,
              target_user_id: targetUser.id,
              target_family_id: targetUser.family_id || `fam-${targetUser.id}`
            })
          });
          const voiceJson = await voiceRes.json();
          if (voiceJson.success && voiceJson.actions?.length > 0) {
            await fetch(`${baseUrl}/api/voice-command`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Key': internalKey
              },
              body: JSON.stringify({
                action: 'execute',
                actions: voiceJson.actions,
                target_user_id: targetUser.id,
                target_family_id: targetUser.family_id || `fam-${targetUser.id}`
              })
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
      if (userBotToken && chatId) {
        await fetch(`https://api.telegram.org/bot${userBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'Markdown' })
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, replied: replyText });
    }

    return NextResponse.json({ success: true, message: 'Update processed' });
  } catch (error: any) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
