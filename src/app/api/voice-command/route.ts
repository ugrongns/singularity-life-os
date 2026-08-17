import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { transactions, walletsAccounts, userHealthProfile, books, shoppingListItems, supplementRoutines, moodLogs } from '@/db/schema';
import { eq , or } from 'drizzle-orm';

interface ParsedAction {
  type: 'expense' | 'water' | 'reading' | 'shopping' | 'supplement' | 'mood' | 'fasting';
  title: string;
  icon: string;
  details: Record<string, any>;
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let isExecution = false;
    let actionsToExecute: ParsedAction[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body.action === 'execute') {
        isExecution = true;
        actionsToExecute = body.actions || [];
      } else {
        text = body.text || '';
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      text = formData.get('text') as string || '';
    }

    // 1. İŞLEMLERİ ONAYLA VE VERİTABANINA YAZ (EXECUTE BATCH)
    if (isExecution) {
      const now = new Date();
      const nowISO = now.toISOString();
      const today = nowISO.split('T')[0];
      const results: string[] = [];

      for (const act of actionsToExecute) {
        if (act.type === 'expense') {
          const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const amount = Number(act.details.amount) || 0;
          const walletId = act.details.wallet_id || 'wallet-garanti';
          
          await db.insert(transactions).values({
            id,
            wallet_id: walletId,
            category_id: act.details.category_id || 'cat-market',
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
          const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, walletId)))[0];
          if (wallet) {
            const newBal = wallet.type === 'credit_card' ? wallet.balance + amount : wallet.balance - amount;
            await db.update(walletsAccounts).set({ balance: newBal, updated_at: nowISO }).where(eq(walletsAccounts.id, walletId));
          }
          results.push(`💳 ${act.details.merchant} (${amount} ₺)`);
        } else if (act.type === 'water') {
          const amount = Number(act.details.amount_ml) || 250;
          const profile = (await db.select().from(userHealthProfile).limit(1))[0];
          const current = (profile?.consumed_water_ml || 0) + amount;
          await db.update(userHealthProfile)
            .set({ consumed_water_ml: current, updated_at: nowISO })
            ;
          results.push(`💧 +${amount} ml Su (Toplam: ${current} ml)`);
        } else if (act.type === 'reading') {
          const pages = Number(act.details.pages) || 10;
          const activeBook = (await db.select().from(books).where(eq(books.status, 'reading')).limit(1))[0] || (await db.select().from(books).limit(1))[0];
          if (activeBook) {
            const newPage = Math.min(activeBook.total_pages, (activeBook.current_page || 0) + pages);
            await db.update(books).set({ current_page: newPage, updated_at: nowISO }).where(eq(books.id, activeBook.id));
            results.push(`📚 ${activeBook.title} (+${pages} sayfa ➔ ${newPage}. sayfa)`);
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
            created_at: nowISO,
            updated_at: nowISO
          });
          results.push(`🛒 ${act.details.name} (Market Listesine eklendi)`);
        } else if (act.type === 'supplement') {
          await db.update(supplementRoutines).set({ is_taken_today: 1, updated_at: nowISO });
          results.push(`💊 Günlük takviyeler alındı olarak işaretlendi`);
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
  const text = rawText.toLowerCase();

  // 1. Harcama / Fatura Tespiti
  // Örn: "Migros'ta 450 TL harcadım", "Benzin aldım 1500 lira", "120 TL kahve içtim"
  const expenseRegex = /(?:([a-zçğıöşü\s]+)(?:'ta|'te|'da|'de|'den|'dan|\s)?\s*)?(\d+(?:[.,]\d+)?)\s*(?:tl|lira|₺)\s*(?:harcadım|ödedim|aldım|fatura|ödemesi|çektim|tutarında)?/gi;
  let match;
  while ((match = expenseRegex.exec(text)) !== null) {
    const rawMerchant = (match[1] || '').trim();
    const amount = parseFloat(match[2].replace(',', '.'));
    if (amount > 0 && amount < 1000000) {
      let merchant = 'Genel Harcama';
      let categoryId = 'cat-market';

      if (rawMerchant.length > 2) {
        merchant = rawMerchant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      if (text.includes('benzin') || text.includes('yakıt') || text.includes('shell') || text.includes('opet') || text.includes('petrol')) {
        merchant = merchant === 'Genel Harcama' ? 'Shell Petrol A.Ş.' : merchant;
        categoryId = 'cat-arac';
      } else if (text.includes('fatura') || text.includes('elektrik') || text.includes('su') || text.includes('internet')) {
        categoryId = 'cat-fatura';
      } else if (text.includes('kahve') || text.includes('yemek') || text.includes('restoran') || text.includes('cafe')) {
        categoryId = 'cat-sosyal';
      }

      actions.push({
        type: 'expense',
        title: `${merchant} Harcaması`,
        icon: categoryId === 'cat-arac' ? '⛽' : categoryId === 'cat-fatura' ? '⚡' : '💳',
        details: {
          merchant,
          amount,
          category_id: categoryId,
          wallet_id: text.includes('nakit') ? 'wallet-cash' : text.includes('iş bank') ? 'wallet-isbank' : 'wallet-garanti'
        }
      });
    }
  }

  // 2. Su Tüketimi Tespiti
  // Örn: "500 ml su içtim", "2 bardak su", "1 litre su"
  if (text.includes('su') && (text.includes('içtim') || text.includes('bardak') || text.includes('ml') || text.includes('litre'))) {
    let ml = 250;
    const mlMatch = text.match(/(\d+)\s*ml/);
    const literMatch = text.match(/(\d+(?:[.,]\d+)?)\s*litre/);
    const glassMatch = text.match(/(\d+)\s*bardak/);

    if (mlMatch) ml = parseInt(mlMatch[1], 10);
    else if (literMatch) ml = Math.round(parseFloat(literMatch[1].replace(',', '.')) * 1000);
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
