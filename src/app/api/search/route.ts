import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  tasks,
  books,
  bookQuotes,
  walletsAccounts,
  transactions,
  recurringBills,
  digitalVaultItems,
  vehicles,
  homeAppliances,
  shoppingListItems,
  notes,
  timeBlocks,
  okrObjectives
} from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { matchesTurkishQuery } from '@/lib/date-utils';

export interface SearchResultItem {
  id: string;
  category: 'tasks' | 'library' | 'finance' | 'vault_vehicle' | 'shopping' | 'notes' | 'calendar' | 'okr';
  categoryLabel: string;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const query = (searchParams.get('q') || '').trim();

    if (query.length < 2) {
      return NextResponse.json({ success: true, data: { results: [] } });
    }

    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;

    // OWASP BOLA: Kişisel ve aile paylaşımlı görünürlük filtreleri
    const [
      taskRows,
      bookRows,
      quoteRows,
      walletRows,
      txRows,
      billRows,
      vaultRows,
      vehicleRows,
      applianceRows,
      shoppingRows,
      noteRows
    ] = await Promise.all([
      db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        due_date: tasks.due_date,
        pillar: tasks.pillar
      }).from(tasks).where(
        or(eq(tasks.user_id, userId), and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1)))
      ).orderBy(desc(tasks.updated_at)).limit(80),

      db.select({
        id: books.id,
        title: books.title,
        author: books.author,
        status: books.status,
        current_page: books.current_page,
        total_pages: books.total_pages
      }).from(books).where(
        or(eq(books.user_id, userId), and(eq(books.family_id, familyId), eq(books.is_family_shared, 1)))
      ).orderBy(desc(books.updated_at)).limit(80),

      db.select({
        id: bookQuotes.id,
        quote_text: bookQuotes.quote_text,
        reflection_note: bookQuotes.reflection_note,
        page_number: bookQuotes.page_number
      }).from(bookQuotes).where(
        or(eq(bookQuotes.user_id, userId), eq(bookQuotes.family_id, familyId))
      ).orderBy(desc(bookQuotes.created_at)).limit(60),

      db.select({
        id: walletsAccounts.id,
        name: walletsAccounts.name,
        type: walletsAccounts.type,
        balance: walletsAccounts.balance,
        currency: walletsAccounts.currency
      }).from(walletsAccounts).where(
        and(
          eq(walletsAccounts.is_active, 1),
          eq(walletsAccounts.family_id, familyId),
          or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1))
        )
      ).limit(40),

      db.select({
        id: transactions.id,
        merchant: transactions.merchant,
        notes: transactions.notes,
        amount: transactions.amount,
        currency: transactions.currency,
        transaction_date: transactions.transaction_date
      }).from(transactions).where(
        and(
          eq(transactions.family_id, familyId),
          or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1))
        )
      ).orderBy(desc(transactions.transaction_date)).limit(100),

      db.select({
        id: recurringBills.id,
        name: recurringBills.name,
        amount: recurringBills.amount,
        due_day: recurringBills.due_day
      }).from(recurringBills).where(
        and(eq(recurringBills.family_id, familyId), eq(recurringBills.status, 'active'))
      ).limit(40),

      db.select({
        id: digitalVaultItems.id,
        title: digitalVaultItems.title,
        type: digitalVaultItems.type,
        issuer: digitalVaultItems.issuer,
        document_number: digitalVaultItems.document_number
      }).from(digitalVaultItems).where(
        or(eq(digitalVaultItems.user_id, userId), and(eq(digitalVaultItems.family_id, familyId), eq(digitalVaultItems.is_family_shared, 1)))
      ).limit(50),

      db.select({
        id: vehicles.id,
        plate: vehicles.plate,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year
      }).from(vehicles).where(
        and(
          eq(vehicles.is_active, 1),
          or(eq(vehicles.user_id, userId), and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1)))
        )
      ).limit(20),

      db.select({
        id: homeAppliances.id,
        name: homeAppliances.name,
        brand: homeAppliances.brand,
        model: homeAppliances.model
      }).from(homeAppliances).where(
        or(eq(homeAppliances.user_id, userId), eq(homeAppliances.family_id, familyId))
      ).limit(40),

      db.select({
        id: shoppingListItems.id,
        name: shoppingListItems.name,
        category: shoppingListItems.category,
        quantity: shoppingListItems.quantity,
        unit: shoppingListItems.unit,
        is_checked: shoppingListItems.is_checked
      }).from(shoppingListItems).where(
        or(eq(shoppingListItems.user_id, userId), eq(shoppingListItems.family_id, familyId))
      ).limit(80),

      db.select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        tags_json: notes.tags_json
      }).from(notes).where(
        or(eq(notes.user_id, userId), and(eq(notes.family_id, familyId), eq(notes.is_family_shared, 1)))
      ).orderBy(desc(notes.updated_at)).limit(80)
    ]);

    const results: SearchResultItem[] = [];

    // 1. Görevler (Maks 5)
    let taskCount = 0;
    for (const t of taskRows) {
      if (taskCount >= 5) break;
      if (matchesTurkishQuery(query, [t.title, t.description, t.pillar])) {
        results.push({
          id: `task-${t.id}`,
          category: 'tasks',
          categoryLabel: 'Görevler & Odak',
          title: t.title,
          subtitle: `${t.status === 'completed' ? '✅ Tamamlandı' : t.status === 'in_progress' ? '🔥 Odakta' : '📋 Bekliyor'}${t.due_date ? ` • ${t.due_date}` : ''}`,
          icon: t.status === 'completed' ? '✅' : '🎯',
          href: '/tasks'
        });
        taskCount++;
      }
    }

    // 2. Kütüphane & Alıntılar (Maks 5)
    let libCount = 0;
    for (const b of bookRows) {
      if (libCount >= 5) break;
      if (matchesTurkishQuery(query, [b.title, b.author])) {
        results.push({
          id: `book-${b.id}`,
          category: 'library',
          categoryLabel: 'Kütüphane',
          title: b.title,
          subtitle: `${b.author} • ${b.current_page}/${b.total_pages} sf`,
          icon: '📚',
          href: '/library'
        });
        libCount++;
      }
    }
    for (const qItem of quoteRows) {
      if (libCount >= 5) break;
      if (matchesTurkishQuery(query, [qItem.quote_text, qItem.reflection_note])) {
        const snippet = qItem.quote_text.length > 68 ? `${qItem.quote_text.slice(0, 68)}...` : qItem.quote_text;
        results.push({
          id: `quote-${qItem.id}`,
          category: 'library',
          categoryLabel: 'Kütüphane',
          title: `"${snippet}"`,
          subtitle: qItem.page_number ? `Alıntı • Sayfa ${qItem.page_number}` : 'Kitap Alıntısı',
          icon: '💬',
          href: '/library'
        });
        libCount++;
      }
    }

    // 3. Finans: Hesaplar, İşlemler & Faturalar (Maks 5)
    let finCount = 0;
    for (const w of walletRows) {
      if (finCount >= 5) break;
      if (matchesTurkishQuery(query, [w.name, w.type])) {
        results.push({
          id: `wallet-${w.id}`,
          category: 'finance',
          categoryLabel: 'Finans & Bütçe',
          title: w.name,
          subtitle: `Hesap • ${Number(w.balance || 0).toLocaleString('tr-TR')} ${w.currency}`,
          icon: '💳',
          href: '/budget'
        });
        finCount++;
      }
    }
    for (const b of billRows) {
      if (finCount >= 5) break;
      if (matchesTurkishQuery(query, [b.name])) {
        results.push({
          id: `bill-${b.id}`,
          category: 'finance',
          categoryLabel: 'Finans & Bütçe',
          title: b.name,
          subtitle: `Sabit Fatura • Her ayın ${b.due_day}. günü • ${Number(b.amount || 0).toLocaleString('tr-TR')} ₺`,
          icon: '🧾',
          href: '/budget'
        });
        finCount++;
      }
    }
    for (const tx of txRows) {
      if (finCount >= 5) break;
      if (matchesTurkishQuery(query, [tx.merchant, tx.notes])) {
        results.push({
          id: `tx-${tx.id}`,
          category: 'finance',
          categoryLabel: 'Finans & Bütçe',
          title: tx.merchant || 'İşlem',
          subtitle: `${tx.transaction_date} • ${Number(tx.amount || 0).toLocaleString('tr-TR')} ${tx.currency}`,
          icon: '💸',
          href: '/budget'
        });
        finCount++;
      }
    }

    // 4. Dijital Kasa, Araç & Ev (Maks 5)
    let vaultCount = 0;
    for (const v of vaultRows) {
      if (vaultCount >= 5) break;
      if (matchesTurkishQuery(query, [v.title, v.type, v.issuer, v.document_number])) {
        results.push({
          id: `vault-${v.id}`,
          category: 'vault_vehicle',
          categoryLabel: 'Dijital Kasa & Araç/Ev',
          title: v.title,
          subtitle: `${v.type}${v.issuer ? ` • ${v.issuer}` : ''}`,
          icon: '🔐',
          href: '/vault'
        });
        vaultCount++;
      }
    }
    for (const car of vehicleRows) {
      if (vaultCount >= 5) break;
      if (matchesTurkishQuery(query, [car.plate, car.make, car.model])) {
        results.push({
          id: `vehicle-${car.id}`,
          category: 'vault_vehicle',
          categoryLabel: 'Dijital Kasa & Araç/Ev',
          title: `${car.plate} — ${car.make} ${car.model}`,
          subtitle: `${car.year} Model Araç`,
          icon: '🚗',
          href: '/vehicles'
        });
        vaultCount++;
      }
    }
    for (const app of applianceRows) {
      if (vaultCount >= 5) break;
      if (matchesTurkishQuery(query, [app.name, app.brand, app.model])) {
        results.push({
          id: `appliance-${app.id}`,
          category: 'vault_vehicle',
          categoryLabel: 'Dijital Kasa & Araç/Ev',
          title: app.name,
          subtitle: `${app.brand || ''} ${app.model || ''}`.trim() || 'Ev Cihazı',
          icon: '🏠',
          href: '/vehicles'
        });
        vaultCount++;
      }
    }

    // 5. Market Listesi (Maks 5)
    let shopCount = 0;
    for (const item of shoppingRows) {
      if (shopCount >= 5) break;
      if (matchesTurkishQuery(query, [item.name, item.category])) {
        results.push({
          id: `shop-${item.id}`,
          category: 'shopping',
          categoryLabel: 'Market Listesi',
          title: item.name,
          subtitle: `${item.quantity} ${item.unit} • ${item.category} ${item.is_checked ? '(Sepette)' : ''}`,
          icon: '🛒',
          href: '/shopping'
        });
        shopCount++;
      }
    }

    // 6. Notlar & İkinci Beyin (Maks 5)
    let noteCount = 0;
    for (const n of noteRows) {
      if (noteCount >= 5) break;
      if (matchesTurkishQuery(query, [n.title, n.content, n.tags_json])) {
        results.push({
          id: `note-${n.id}`,
          category: 'notes',
          categoryLabel: 'Notlar & İkinci Beyin',
          title: n.title,
          subtitle: n.content.slice(0, 60).replace(/\s+/g, ' ').trim() || 'Not',
          icon: '📝',
          href: '/notes'
        });
        noteCount++;
      }
    }

    // 7 & 8. Zaman Blokları & OKR Hedefleri (Maks 5 + 5)
    try {
      const [blockRows, okrRows] = await Promise.all([
        db
          .select({
            id: timeBlocks.id,
            title: timeBlocks.title,
            date: timeBlocks.date,
            start_time: timeBlocks.start_time,
            end_time: timeBlocks.end_time,
            notes: timeBlocks.notes,
          })
          .from(timeBlocks)
          .where(
            or(
              eq(timeBlocks.user_id, userId),
              and(eq(timeBlocks.family_id, familyId), eq(timeBlocks.is_family_shared, 1))
            )
          )
          .orderBy(desc(timeBlocks.date))
          .limit(50),
        db
          .select({
            id: okrObjectives.id,
            title: okrObjectives.title,
            description: okrObjectives.description,
            period: okrObjectives.period,
          })
          .from(okrObjectives)
          .where(
            or(
              eq(okrObjectives.user_id, userId),
              and(eq(okrObjectives.family_id, familyId), eq(okrObjectives.is_family_shared, 1))
            )
          )
          .orderBy(desc(okrObjectives.updated_at))
          .limit(50),
      ]);

      let blockCount = 0;
      for (const b of blockRows) {
        if (blockCount >= 5) break;
        if (matchesTurkishQuery(query, [b.title, b.notes || ''])) {
          results.push({
            id: `block-${b.id}`,
            category: 'calendar',
            categoryLabel: 'Zaman Bloklama',
            title: b.title,
            subtitle: `${b.date} • ${b.start_time}-${b.end_time}`,
            icon: '📅',
            href: '/calendar',
          });
          blockCount++;
        }
      }

      let okrCount = 0;
      for (const o of okrRows) {
        if (okrCount >= 5) break;
        if (matchesTurkishQuery(query, [o.title, o.description || ''])) {
          results.push({
            id: `okr-${o.id}`,
            category: 'okr',
            categoryLabel: 'OKR & Vizyon',
            title: o.title,
            subtitle: `${o.period} • Stratejik Hedef`,
            icon: '🎯',
            href: '/okr',
          });
          okrCount++;
        }
      }
    } catch {
      // Non-fatal fallback
    }

    return NextResponse.json({ success: true, data: { results } });
  } catch (error: any) {
    console.error('Global Search API Error:', error);
    return NextResponse.json({ success: false, error: 'Arama yapılırken bir hata oluştu.' }, { status: 500 });
  }
}
