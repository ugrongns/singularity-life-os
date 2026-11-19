import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { transactions, walletsAccounts, books, shoppingListItems, supplementRoutines, supplementIntakeLogs, moodLogs, users, tasks } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { parseTurkishNumber } from '@/lib/ebelge-parser';
import { getTodayTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';
import { validateMitConstraint } from '@/lib/tasks-engine';
import { ensureFamilyCategories, normalizeCategoryTemplateBaseId, resolveCategoryIdForFamily } from '@/lib/budget-categories';
import { syncDailyWaterIntake } from '@/lib/health-water';

interface ParsedAction {
  type: 'expense' | 'water' | 'reading' | 'shopping' | 'supplement' | 'mood' | 'fasting' | 'task';
  title: string;
  icon: string;
  details: Record<string, any>;
}

// Bulgu 6: Tip koruyucu (Type Guard)
function isValidParsedAction(act: any): act is ParsedAction {
  if (!act || typeof act !== 'object') return false;
  const validTypes = ['expense', 'water', 'reading', 'shopping', 'supplement', 'mood', 'fasting', 'task'];
  return (
    validTypes.includes(act.type) &&
    typeof act.title === 'string' &&
    typeof act.icon === 'string' &&
    act.details &&
    typeof act.details === 'object'
  );
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    const incomingInternalKey = req.headers.get('x-internal-service-key');
    const isInternalService = Boolean(internalKey && incomingInternalKey && incomingInternalKey === internalKey);

    let user = null;
    if (!isInternalService) {
      user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
      }
    } else {
      user = await getAuthUser();
    }

    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let isExecution = false;
    let actionsToExecute: ParsedAction[] = [];

    let targetUserIdFromInternal = '';
    let targetFamilyIdFromInternal = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body.action === 'execute') {
        isExecution = true;
        if (Array.isArray(body.actions)) {
          actionsToExecute = body.actions.filter(isValidParsedAction);
        }
      } else {
        text = body.text || '';
      }
      if (isInternalService) {
        targetUserIdFromInternal = body.target_user_id || '';
        targetFamilyIdFromInternal = body.target_family_id || '';
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      text = formData.get('text') as string || '';
    }

    // 1. İŞLEMLERİ ONAYLA VE VERİTABANINA YAZ (EXECUTE BATCH)
    if (isExecution) {
      const now = new Date();
      const nowISO = now.toISOString();
      const today = getTodayTurkeyDate(now);
      const results: string[] = [];

      const currentUserId = targetUserIdFromInternal || user?.id || (await db.select().from(users).where(eq(users.is_master_account, 1)).limit(1))[0]?.id;
      if (!currentUserId) {
        return NextResponse.json({ success: false, error: 'Aktif kullanıcı bulunamadı.' }, { status: 401 });
      }
      const currentFamilyId = targetFamilyIdFromInternal || user?.family_id || `fam-${currentUserId}`;

      for (const act of actionsToExecute) {
        if (act.type === 'expense') {
          const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const amount = Number(act.details.amount) || 0;
          let walletId = act.details.wallet_id;
          let wallet = walletId ? (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, walletId)).limit(1))[0] : null;

          if (!wallet) {
            const userWallets = await db.select().from(walletsAccounts).where(
              or(eq(walletsAccounts.user_id, currentUserId), eq(walletsAccounts.family_id, currentFamilyId))
            );
            const hint = String(act.details.wallet_hint || '').toLowerCase();
            if (hint && userWallets.length > 0) {
              wallet = userWallets.find((w: any) => w.name.toLowerCase().includes(hint) || (hint === 'nakit' && w.type === 'cash')) || userWallets[0];
            } else {
              wallet = userWallets[0] || null;
            }
            if (!wallet) {
              results.push(`⚠️ ${act.details.merchant || 'Harcama'} kaydedilemedi: Önce bir cüzdan/hesap oluşturun.`);
              continue;
            }
            walletId = wallet.id;
          }
          
          const rawCatId = act.details.category_id || 'cat-market';
          const resolvedCatId = currentFamilyId
            ? resolveCategoryIdForFamily(currentFamilyId, rawCatId)
            : rawCatId;
          if (currentFamilyId && normalizeCategoryTemplateBaseId(rawCatId)) {
            try {
              await ensureFamilyCategories(currentFamilyId);
            } catch {}
          }

          await db.insert(transactions).values({
            id,
            wallet_id: walletId,
            category_id: resolvedCatId,
            user_id: currentUserId,
            family_id: currentFamilyId,
            merchant: act.details.merchant || 'Sesli Harcama',
            amount,
            currency: 'TRY',
            transaction_date: today,
            notes: '🎙️ Sesli Çoklu Komut ile eklendi',
            is_installment: 0,
            installment_number: 1,
            total_installments: 1,
            is_verified: 1,
            is_family_shared: 1,
            created_at: nowISO,
            updated_at: nowISO,
            sync_status: 'synced',
            device_id: 'voice-ai'
          });

          // Cüzdan Bakiyesi
          if (wallet) {
            const newBal = wallet.type === 'credit_card' ? wallet.balance + amount : wallet.balance - amount;
            await db.update(walletsAccounts).set({ balance: newBal, updated_at: nowISO }).where(eq(walletsAccounts.id, walletId));
          }
          results.push(`💳 ${act.details.merchant} (${amount} ₺)`);
        } else if (act.type === 'water') {
          const parsedAmount = Number(act.details.amount_ml);
          const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 250;
          const { consumedMl, addedMl } = await syncDailyWaterIntake({
            userId: currentUserId,
            familyId: currentFamilyId,
            amountMl: amount,
            defaultAddMl: 250,
            nowDate: now,
          });
          results.push(`💧 +${addedMl} ml Su (Toplam: ${consumedMl} ml)`);
        } else if (act.type === 'reading') {
          const pages = Math.max(1, Number(act.details.pages) || 10);
          if (currentUserId) {
            const visibleBookScope = currentFamilyId
              ? or(eq(books.user_id, currentUserId), and(eq(books.family_id, currentFamilyId), eq(books.is_family_shared, 1)))
              : eq(books.user_id, currentUserId);
            const activeBook =
              (await db.select().from(books).where(and(visibleBookScope, eq(books.status, 'reading'))).limit(1))[0]
              || (await db.select().from(books).where(visibleBookScope).limit(1))[0];

            if (activeBook) {
              const rawTarget = (activeBook.current_page || 0) + pages;
              const newPage = activeBook.total_pages > 0
                ? Math.min(activeBook.total_pages, rawTarget)
                : rawTarget;
              const isCompleted = activeBook.total_pages > 0 && newPage >= activeBook.total_pages;
              const todayTr = getTodayTurkeyDate();
              await db.update(books).set({
                current_page: newPage,
                status: isCompleted ? 'completed' : 'reading',
                start_date: activeBook.start_date || todayTr,
                finish_date: isCompleted ? (activeBook.finish_date || todayTr) : activeBook.finish_date,
                updated_at: nowISO
              }).where(eq(books.id, activeBook.id));
              results.push(`📚 ${activeBook.title} (+${pages} sayfa ➔ ${newPage}. sayfa)`);
            }
          }
        } else if (act.type === 'shopping') {
          const id = `shop-voice-${Date.now()}`;
          await db.insert(shoppingListItems).values({
            id,
            name: act.details.name || 'Alışveriş Ürünü',
            quantity: act.details.quantity || '1',
            unit: act.details.unit || 'adet',
            category: act.details.category || 'Market',
            is_checked: 0,
            source: 'voice_command',
            user_id: currentUserId,
            family_id: currentFamilyId,
            created_at: nowISO,
            updated_at: nowISO
          });
          results.push(`🛒 ${act.details.name} (Market Listesine eklendi)`);
        } else if (act.type === 'supplement') {
          if (currentUserId) {
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
            const yesterdayDate = new Date(Date.now() - 86400000);
            const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(yesterdayDate);

            const activeSupps = await db.select().from(supplementRoutines).where(
              and(eq(supplementRoutines.is_active, 1), eq(supplementRoutines.user_id, currentUserId))
            );

            let suppCount = 0;
            for (const supp of activeSupps) {
              if (supp.last_taken_date !== todayStr) {
                const newStreak = (supp.last_taken_date === yesterdayStr) ? (supp.streak_days || 0) + 1 : 1;
                const newRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
                  ? Math.max(0, supp.remaining_pills - 1)
                  : null;

                await db.update(supplementRoutines).set({
                  is_taken_today: 1,
                  streak_days: newStreak,
                  remaining_pills: newRemaining,
                  last_taken_date: todayStr,
                  updated_at: nowISO
                }).where(eq(supplementRoutines.id, supp.id));

                const logId = `supp-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                await db.insert(supplementIntakeLogs).values({
                  id: logId,
                  supplement_id: supp.id,
                  user_id: currentUserId,
                  family_id: currentFamilyId,
                  member_id: supp.member_id || null,
                  supplement_name: supp.name,
                  dose: supp.dose,
                  timing: supp.timing,
                  date: todayStr,
                  taken_at: nowISO,
                  created_at: nowISO,
                  updated_at: nowISO
                });
                suppCount++;
              }
            }
            results.push(`💊 ${suppCount > 0 ? `${suppCount} takviye alındı olarak işlendi` : 'Takviyeleriniz bugün zaten alınmıştı'}`);
          }
        } else if (act.type === 'task') {
          const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const taskDueDate = act.details.due_date || today;
          let finalIsMit = act.details.is_mit ? 1 : 0;
          let mitNotice = '';

          if (finalIsMit === 1) {
            const visibleTasks = await db.select({
              id: tasks.id,
              is_mit: tasks.is_mit,
              status: tasks.status,
              due_date: tasks.due_date
            }).from(tasks).where(
              or(
                eq(tasks.user_id, currentUserId),
                and(eq(tasks.family_id, currentFamilyId), eq(tasks.is_family_shared, 1))
              )
            );
            const mitCheck = validateMitConstraint(visibleTasks, taskDueDate);
            if (!mitCheck.allowed) {
              finalIsMit = 0;
              mitNotice = ' (3 MIT limiti dolu olduğu için normal görev olarak eklendi)';
            }
          }

          await db.insert(tasks).values({
            id: taskId,
            title: act.details.title || act.title,
            description: act.details.description || null,
            status: 'pending',
            priority: act.details.priority || 'medium',
            pillar: act.details.pillar || 'general',
            is_mit: finalIsMit,
            due_date: taskDueDate,
            recurrence: act.details.recurrence || 'none',
            subtasks_json: '[]',
            is_family_shared: 0,
            completed_at: null,
            user_id: currentUserId,
            family_id: currentFamilyId,
            created_at: nowISO,
            updated_at: nowISO
          });
          results.push(`🎯 Görev: ${act.details.title || act.title}${mitNotice}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${results.length} işlem başarıyla kaydedildi ve ilgili modüllere işlendi!`,
        executed: results
      });
    }

    // 2. SESLİ METNİ AYRIŞTIR (PARSE VOICE TEXT)
    const actions = parseVoiceCommandText(text);

    return NextResponse.json({
      success: true,
      raw_text: text,
      actions_count: actions.length,
      actions
    });
  } catch (error: any) {
    console.error('Voice Command API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Akıllı Doğal Dil Ayrıştırıcısı (NLP & Rule Engine)
function parseVoiceCommandText(rawText: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const text = rawText.toLocaleLowerCase('tr-TR');

  // 1. Harcama / Fatura Tespiti
  // Örn: "Migros'ta 450 TL harcadım", "Benzin aldım 1500 lira", "120 TL kahve içtim"
  const expenseRegex = /(?:([a-zçğıöşü\s]+)(?:'ta|'te|'da|'de|'den|'dan|\s)?\s*)?(\d+(?:[.,]\d+)*)\s*(?:tl|lira|₺)\s*(?:harcadım|ödedim|aldım|fatura|ödemesi|çektim|tutarında)?/gi;
  let match;
  while ((match = expenseRegex.exec(text)) !== null) {
    const rawMerchant = (match[1] || '').trim();
    const amount = parseTurkishNumber(match[2]);
    if (amount > 0 && amount < 1000000) {
      let merchant = 'Genel Harcama';
      let categoryId = 'cat-market';

      if (rawMerchant.length > 2) {
        merchant = rawMerchant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      if (text.includes('benzin') || text.includes('yakıt') || text.includes('shell') || text.includes('opet') || text.includes('petrol')) {
        merchant = merchant === 'Genel Harcama' ? 'Akaryakıt Harcaması' : merchant;
        categoryId = 'cat-ulasim';
      } else if (text.includes('fatura') || text.includes('elektrik') || text.includes('su') || text.includes('internet')) {
        categoryId = 'cat-fatura';
      } else if (text.includes('kahve') || text.includes('yemek') || text.includes('restoran') || text.includes('cafe')) {
        categoryId = 'cat-eeglence';
      }

      actions.push({
        type: 'expense',
        title: `${merchant} Harcaması`,
        icon: categoryId === 'cat-ulasim' ? '⛽' : categoryId === 'cat-fatura' ? '⚡' : '💳',
        details: {
          merchant,
          amount,
          category_id: categoryId,
          wallet_hint: text.includes('nakit') ? 'nakit' : text.includes('iş bank') ? 'iş bank' : undefined
        }
      });
    }
  }

  // 2. Su Tüketimi Tespiti
  // Örn: "500 ml su içtim", "2 bardak su", "1 litre su"
  if (text.includes('su') && (text.includes('içtim') || text.includes('bardak') || text.includes('ml') || text.includes('litre'))) {
    let ml = 250;
    const mlMatch = text.match(/(\d+)\s*ml/);
    const literMatch = text.match(/(\d+(?:[.,]\d+)*)\s*litre/);
    const glassMatch = text.match(/(\d+)\s*bardak/);

    if (mlMatch) ml = parseInt(mlMatch[1], 10);
    else if (literMatch) ml = Math.round(parseTurkishNumber(literMatch[1]) * 1000);
    else if (glassMatch) ml = parseInt(glassMatch[1], 10) * 250;
    else if (text.includes('büyük bardak')) ml = 400;

    actions.push({
      type: 'water',
      title: `${ml} ml Su Tüketimi`,
      icon: '💧',
      details: { amount_ml: ml }
    });
  }

  // 3. Kitap Okuma Tespiti
  // Örn: "Kitaptan 35 sayfa okudum", "Bastiat 20 sayfa"
  const bookMatch = text.match(/(\d+)\s*sayfa\s*(?:kitap\s*)?(?:okudum|bitirdim|ilerledim)/i);
  if (bookMatch) {
    const pages = parseInt(bookMatch[1], 10);
    actions.push({
      type: 'reading',
      title: `${pages} Sayfa Kitap Okuma`,
      icon: '📚',
      details: { pages }
    });
  }

  // 4. Market Listesi Ekleme Tespiti
  // Örn: "Market listesine zeytinyağı ekle", "Listeye 2 adet ekmek yaz"
  const shopMatch = text.match(/(?:listeye|markete|alışverişe)\s*(?:(\d+)\s*(?:adet|kilo|kg|şişe|paket)?\s*)?([a-zçğıöşü\s]+)(?:ekle|yaz|koy)/i);
  if (shopMatch) {
    const qty = shopMatch[1] || '1';
    const itemName = shopMatch[2].trim();
    if (itemName.length > 2) {
      actions.push({
        type: 'shopping',
        title: `${itemName} (Market Listesi)`,
        icon: '🛒',
        details: { name: itemName.charAt(0).toUpperCase() + itemName.slice(1), quantity: qty, unit: 'adet', category: 'Market' }
      });
    }
  }

  // 5. Takviye Rutini Tespiti
  // Örn: "Vitaminlerimi aldım", "Takviyeleri içtim"
  if (text.includes('vitamin') || text.includes('takviye') || text.includes('magnezyum') || text.includes('omega')) {
    actions.push({
      type: 'supplement',
      title: 'Günlük Takviye Rutini',
      icon: '💊',
      details: { is_taken_today: 1 }
    });
  }

  // 6. Görev / To-Do Tespiti
  // Örn: "Görev ekle: muhasebeciyi ara", "Yarın için kasko yenileme görevi ekle", "Yapılacaklara rapor hazırla yaz"
  const taskMatch =
    text.match(/(?:^|,|\sve\s)\s*(?:(?:yarın|bugün)(?:\s+için)?\s+)?([a-zçğıöşü0-9\s]+?)\s+(?:görevi|işi)\s+(?:ekle|yaz|koy)(?=$|[.,!]|\s+ve\s)(?!\s*[:\-])/i)
    || text.match(/(?:görev(?:lere|e|i)?|yapılacaklara?|hatırlatıcı|to-?do)(?![a-zçğıöşü])\s*(?:olarak)?\s*(?:ekle|yaz|koy)?\s*[:\s-]\s*([a-zçğıöşü0-9\s]+?)(?:\s+görevi|\s+yapılacak)?\s*(?:ekle|yaz|koy)?$/i);

  if (taskMatch && taskMatch[1]) {
    const taskTitle = taskMatch[1].trim();
    if (taskTitle.length > 2 && !taskTitle.includes('market') && !taskTitle.includes('alışveriş')) {
      const isTomorrow = text.includes('yarın');
      const todayTr = getTodayTurkeyDate();
      const targetDueDate = isTomorrow ? shiftTurkeyDate(todayTr, 1) : todayTr;
      const isMitCandidate = text.includes('odak') || text.includes('önemli') || /(?:^|[^a-zçğıöşü])mit(?=$|[^a-zçğıöşü])/i.test(text);
      const formattedTitle = taskTitle.charAt(0).toLocaleUpperCase('tr-TR') + taskTitle.slice(1);

      actions.push({
        type: 'task',
        title: `${formattedTitle} (Görev)`,
        icon: '🎯',
        details: {
          title: formattedTitle,
          due_date: targetDueDate,
          is_mit: isMitCandidate ? 1 : 0,
          pillar: text.includes('fatura') || text.includes('vergi') || text.includes('para') || text.includes('kart') ? 'finance' : 'general',
          priority: isMitCandidate ? 'high' : 'medium'
        }
      });
    }
  }

  // Eğer hiçbir şey yakalanamadıysa en azından harcama/not olarak varsayılan oluştur
  if (actions.length === 0 && rawText.trim().length > 0) {
    actions.push({
      type: 'shopping',
      title: rawText.trim(),
      icon: '📝',
      details: { name: rawText.trim(), quantity: '1', unit: 'adet', category: 'Genel' }
    });
  }

  return actions;
}
