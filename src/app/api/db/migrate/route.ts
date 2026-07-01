import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Veritabanı şemasını güncelle (tablo yoksa oluştur)
export async function GET() {
  try {
    // SentNotification tablosu var mı kontrol et
    const result = await db.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'SentNotification'
    ` as any[];

    if (result.length === 0) {
      // Tablo yoksa oluştur
      await db.$executeRaw`
        CREATE TABLE "SentNotification" (
          "id" TEXT NOT NULL,
          "notifKey" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
        )
      `;
      await db.$executeRaw`
        CREATE UNIQUE INDEX "SentNotification_notifKey_key" ON "SentNotification"("notifKey")
      `;
      return NextResponse.json({ success: true, message: 'SentNotification tablosu oluşturuldu' });
    }

    return NextResponse.json({ success: true, message: 'SentNotification tablosu zaten mevcut' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
