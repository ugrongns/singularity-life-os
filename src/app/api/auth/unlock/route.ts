import { NextResponse } from 'next/server';
import { initDatabase } from '@/db';
import { getAuthUser, verifyPin, sanitizeUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser({ includeSecrets: true });

    if (!user || !user.id) {
      return NextResponse.json({
        success: false,
        error: 'Aktif oturum bulunamadı. Lütfen önce tam giriş yapın.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    if (!pin || String(pin).length !== 6 || !/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({
        success: false,
        error: 'Hızlı PIN tam olarak 6 haneli rakamlardan oluşmalıdır.'
      }, { status: 400 });
    }

    const isValidPin = await verifyPin(String(pin), user.quick_pin_hash, user.password_salt, user.pin_salt);
    if (!isValidPin) {
      return NextResponse.json({
        success: false,
        error: 'Hatalı 6 haneli PIN kodu.'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Kilit başarıyla açıldı!',
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error: any) {
    console.error('Unlock API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
