import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { homeMaintenanceRecords, homeAppliances, walletsAccounts, transactions } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { eventBus, EVENTS } from '@/lib/events';
import { ensureFamilyCategories, getFamilySeedCategoryId } from '@/lib/budget-categories';
import { getTodayTurkeyDate, diffTurkeyCalendarDays, parseTurkeyCalendarDate } from '@/lib/date-utils';

function getVisibleWalletsWhere(userId: string, familyId?: string | null) {
  return and(
    eq(walletsAccounts.is_active, 1),
    familyId
      ? or(
          eq(walletsAccounts.user_id, userId),
          and(eq(walletsAccounts.family_id, familyId), eq(walletsAccounts.is_family_shared, 1)),
          and(eq(walletsAccounts.family_id, familyId), sql`${walletsAccounts.user_id} IS NULL`)
        )
      : eq(walletsAccounts.user_id, userId)
  );
}

function isWalletAccessibleByUser(wallet: any, userId: string, familyId?: string | null): boolean {
  if (!wallet || wallet.is_active === 0) return false;
  if (wallet.user_id === userId) return true;
  const isSameFamily = wallet.family_id ? Boolean(familyId && wallet.family_id === familyId) : false;
  return isSameFamily && (wallet.is_family_shared === 1 || !wallet.user_id);
}

function validateWalletSpendLimit(wallet: any, amount: number): { ok: boolean; error?: string } {
  const currentBalance = Number(wallet.balance) || 0;
  if (wallet.type === 'credit_card') {
    const creditLimit = Number(wallet.credit_limit) || 0;
    if (creditLimit > 0) {
      const avail = Math.max(0, creditLimit - currentBalance);
      if (amount > avail) {
        return {
          ok: false,
          error: `Kredi Kartı Limiti Aşıldı! ${wallet.name} kartınızın kullanılabilir limiti sadece ${avail.toLocaleString('tr-TR')} ₺'dir.`,
        };
      }
    }
    return { ok: true };
  }

  if (wallet.type === 'kmh') {
    const avail = currentBalance + (Number(wallet.overdraft_limit) || 0);
    if (amount > avail) {
      return {
        ok: false,
        error: `KMH (Ek Hesap) Limiti Aşıldı! ${wallet.name} hesabınızın kullanılabilir toplam limiti ${avail.toLocaleString('tr-TR')} ₺'dir.`,
      };
    }
    return { ok: true };
  }

  if (amount > currentBalance) {
    return {
      ok: false,
      error: `Yetersiz Bakiye! ${wallet.name} hesabınızda sadece ${currentBalance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`,
    };
  }
  return { ok: true };
}

function addMonthsSafe(baseDate: Date, months: number): string {
  const d = new Date(baseDate.getTime());
  if (isNaN(d.getTime())) return getTodayTurkeyDate();
  const currentDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(currentDay, maxDays));
  return getTodayTurkeyDate(d);
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const todayStr = getTodayTurkeyDate();

    const records = await db.select().from(homeMaintenanceRecords).where(
      familyId
        ? or(eq(homeMaintenanceRecords.family_id, familyId), eq(homeMaintenanceRecords.user_id, userId))
        : eq(homeMaintenanceRecords.user_id, userId)
    );

    const processedMaintenance = records.map((rec: any) => {
      let daysLeft: number | null = null;
      let status: 'urgent' | 'warning' | 'ok' = 'ok';

      if (rec.next_due_date) {
        const diff = diffTurkeyCalendarDays(rec.next_due_date, todayStr);
        if (diff !== null) {
          daysLeft = diff;
          status = daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'ok';
        }
      }

      return {
        ...rec,
        days_left: daysLeft,
        status
      };
    });

    // Ev Demirbaşları & Garanti Süreleri
    const appliances = await db.select().from(homeAppliances).where(
      familyId
        ? or(eq(homeAppliances.family_id, familyId), eq(homeAppliances.user_id, userId))
        : eq(homeAppliances.user_id, userId)
    );
    const processedAppliances = appliances.map((app: any) => {
      let daysLeftWarranty: number | null = null;
      let isWarrantyActive = false;

      if (app.warranty_expiry_date) {
        const diff = diffTurkeyCalendarDays(app.warranty_expiry_date, todayStr);
        if (diff !== null) {
          daysLeftWarranty = diff;
          isWarrantyActive = daysLeftWarranty >= 0;
        }
      }

      return {
        ...app,
        days_left_warranty: daysLeftWarranty,
        is_warranty_active: isWarrantyActive
      };
    });

    const wallets = await db.select().from(walletsAccounts).where(getVisibleWalletsWhere(userId, familyId));

    return NextResponse.json({
      success: true,
      data: {
        maintenanceRecords: processedMaintenance,
        appliances: processedAppliances,
        wallets
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { action, record_id, months = 6, ...data } = body;
    const now = new Date();
    const nowStr = now.toISOString();
    const familyId = user.family_id || `fam-${user.id}`;
    const todayStr = getTodayTurkeyDate();
    const baseTurkeyToday = parseTurkeyCalendarDate(todayStr);

    // Filtre / Bakım Yenileme (Reset Interval + Opsiyonel Bütçe Gideri)
    if (action === 'reset_filter' || record_id) {
      const targetId = record_id || data.id;
      if (!targetId) {
        return NextResponse.json({ success: false, error: 'Bakım kaydı ID belirtilmelidir.' }, { status: 400 });
      }
      const ownershipWhere = and(
        eq(homeMaintenanceRecords.id, targetId),
        or(eq(homeMaintenanceRecords.user_id, user.id), eq(homeMaintenanceRecords.family_id, familyId))
      );
      const existing = (await db.select().from(homeMaintenanceRecords).where(ownershipWhere).limit(1))[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Bakım kaydı bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const rawInterval = Number(months ?? data.months ?? existing.interval_months ?? 6);
      const interval = Number.isFinite(rawInterval) && rawInterval > 0 ? Math.round(rawInterval) : (existing.interval_months || 6);
      const nextDate = addMonthsSafe(baseTurkeyToday, interval);

      const walletId = typeof data.wallet_id === 'string' ? data.wallet_id.trim() : '';
      const rawCost = data.cost !== undefined ? data.cost : data.amount;
      const numericCost = rawCost !== undefined && rawCost !== '' ? Number(rawCost) : 0;

      if (rawCost !== undefined && rawCost !== '' && (!Number.isFinite(numericCost) || numericCost < 0)) {
        return NextResponse.json({ success: false, error: 'Geçerli bir bakım tutarı girin.' }, { status: 400 });
      }

      let authorizedWallet: any = null;
      if (walletId && numericCost > 0) {
        const walletCandidate = (await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.id, walletId),
            getVisibleWalletsWhere(user.id, familyId)
          )
        ).limit(1))[0];

        if (!isWalletAccessibleByUser(walletCandidate, user.id, familyId)) {
          return NextResponse.json({ success: false, error: 'Seçilen cüzdan bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
        }

        const limitCheck = validateWalletSpendLimit(walletCandidate, numericCost);
        if (!limitCheck.ok) {
          return NextResponse.json({ success: false, error: limitCheck.error }, { status: 400 });
        }
        authorizedWallet = walletCandidate;
      }

      let createdTxId: string | null = null;
      let resolvedCategoryId: string | null = null;

      await db.transaction(async (tx) => {
        await tx.update(homeMaintenanceRecords)
          .set({
            last_serviced_date: todayStr,
            next_due_date: nextDate,
            status: 'ok',
            updated_at: nowStr
          })
          .where(ownershipWhere);

        if (authorizedWallet && numericCost > 0) {
          resolvedCategoryId = getFamilySeedCategoryId('cat-kira', familyId);
          await ensureFamilyCategories(familyId, tx);

          const isCreditCard = authorizedWallet.type === 'credit_card';
          await tx.update(walletsAccounts).set({
            balance: isCreditCard
              ? sql`${walletsAccounts.balance} + ${numericCost}`
              : sql`${walletsAccounts.balance} - ${numericCost}`,
            updated_at: nowStr
          }).where(eq(walletsAccounts.id, walletId));

          createdTxId = `tx-home-${Date.now()}`;
          await tx.insert(transactions).values({
            id: createdTxId,
            wallet_id: walletId,
            category_id: resolvedCategoryId,
            user_id: user.id,
            family_id: familyId,
            merchant: `${existing.title} - Ev Bakımı`,
            amount: numericCost,
            currency: authorizedWallet.currency || 'TRY',
            transaction_date: todayStr,
            notes: `Ev periyodik bakım yenilemesi (${interval} ay periyot)`,
            is_verified: 1,
            is_family_shared: 1,
            created_at: nowStr,
            updated_at: nowStr,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      });

      if (createdTxId && resolvedCategoryId) {
        await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
          transactionId: createdTxId,
          wallet_id: walletId,
          category_id: resolvedCategoryId,
          amount: numericCost,
          merchant: `${existing.title} - Ev Bakımı`,
          user_id: user.id,
          userId: user.id,
          family_id: familyId,
          familyId
        });
      }

      return NextResponse.json({
        success: true,
        message: createdTxId
          ? `🚰 Bakım sıfırlandı ve ₺${numericCost.toLocaleString('tr-TR')} bütçeye işlendi!`
          : '🚰 Bakım sıfırlandı ve yeni periyot başlatıldı!'
      });
    }

    // Yeni Ev Bakım Kalemi Ekleme
    if (action === 'add_maintenance') {
      const id = `hm-${Date.now()}`;
      const parsedInterval = parseInt(data.interval_months, 10);
      const interval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 6;
      const parsedCost = data.cost_estimate !== undefined && data.cost_estimate !== '' ? Number(data.cost_estimate) : 0;
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        return NextResponse.json({ success: false, error: 'Geçerli bir tahmini tutar girin.' }, { status: 400 });
      }
      const nextDate = addMonthsSafe(baseTurkeyToday, interval);

      await db.insert(homeMaintenanceRecords).values({
        id,
        item_type: data.item_type || 'custom',
        title: data.title || 'Ev Bakımı',
        last_serviced_date: todayStr,
        next_due_date: nextDate,
        interval_months: interval,
        cost_estimate: parsedCost,
        status: 'ok',
        user_id: user.id,
        family_id: familyId,
        created_at: nowStr,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true, message: '🏠 Ev bakım görevi eklendi!' });
    }

    // Yeni Ev Demirbaşı & Garanti Kaydı Ekleme
    if (action === 'add_appliance') {
      const id = `app-${Date.now()}`;
      const parsedWarranty = parseInt(data.warranty_months, 10);
      const warrantyMonths = Number.isFinite(parsedWarranty) && parsedWarranty > 0 ? parsedWarranty : 24;

      // Geçersiz tarih kontrolü ile RangeError: Invalid time value koruması
      let basePurchaseDate = baseTurkeyToday;
      if (data.purchase_date) {
        const rawDate = String(data.purchase_date).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          basePurchaseDate = parseTurkeyCalendarDate(rawDate);
        } else {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            basePurchaseDate = parsed;
          }
        }
      }

      const purchaseDate = getTodayTurkeyDate(basePurchaseDate);
      const expiryDate = addMonthsSafe(basePurchaseDate, warrantyMonths);
      const rawReceipt = typeof data.receipt_url === 'string' ? data.receipt_url.trim() : '';
      const safeReceiptUrl = /^(data:(image\/|application\/pdf)|https:\/\/|\/uploads\/)/i.test(rawReceipt)
        ? rawReceipt
        : null;

      await db.insert(homeAppliances).values({
        id,
        name: data.name || 'Ev Cihazı',
        brand: data.brand || '',
        model: data.model || '',
        purchase_date: purchaseDate,
        warranty_months: warrantyMonths,
        warranty_expiry_date: expiryDate,
        service_phone: data.service_phone || '',
        receipt_url: safeReceiptUrl,
        notes: data.notes || '',
        user_id: user.id,
        family_id: familyId,
        created_at: nowStr,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true, message: '📺 Ev demirbaşı & garanti kaydı oluşturuldu!' });
    }

    if (action === 'delete_appliance') {
      if (!data.id) {
        return NextResponse.json({ success: false, error: 'Cihaz ID belirtilmelidir.' }, { status: 400 });
      }
      const ownershipWhere = and(
        eq(homeAppliances.id, data.id),
        or(eq(homeAppliances.user_id, user.id), eq(homeAppliances.family_id, familyId))
      );
      const existing = (await db.select().from(homeAppliances).where(ownershipWhere).limit(1))[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Cihaz kaydı bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      await db.delete(homeAppliances).where(ownershipWhere);
      return NextResponse.json({ success: true, message: 'Cihaz kaydı silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
