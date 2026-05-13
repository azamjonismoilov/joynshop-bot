import { getTgUser } from './telegram';

/**
 * Telegram user avatar URL — Phase 1 (frontend-only).
 *
 * `tg.initDataUnsafe.user.photo_url` qiymatini qaytaradi. Foydalanuvchi
 * Telegram'da profile rasmi qo'ymagan bo'lsa yoki privacy sozlamalari
 * ruxsat bermasa — null. UI initials fallback ko'rsatadi.
 *
 * Phase 2 (keyingi sprint): backend `/api/me/avatar` endpoint —
 * Telegram Bot API getUserProfilePhotos + S3 cache.
 */
export function useAvatar(): string | null {
  const user = getTgUser();
  return user?.photo_url || null;
}
