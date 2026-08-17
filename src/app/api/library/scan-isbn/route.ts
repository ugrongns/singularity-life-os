import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Kitap tarama modülü yeniden yapılandırılıyor.'
  });
}
