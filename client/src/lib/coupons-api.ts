import { apiFetchJson } from './http';

export interface CouponRow {
  id: number;
  user_id: number;
  type: 'otomatik' | 'kayitli';
  week: string;
  data: string;
  created_at: string;
  share_id?: number;
  sender_id?: number;
  sender_username?: string;
  sender_email?: string;
  shared_at?: string;
  share_message?: string | null;
}

const BASE_URL = '/api';

export const couponsApi = {
  getCoupons: async (type?: string): Promise<CouponRow[]> => {
    const url = type ? `${BASE_URL}/coupons?type=${type}` : `${BASE_URL}/coupons`;
    return apiFetchJson<CouponRow[]>(url, {}, {
      defaultError: 'Kuponlar alinamadi',
      redirectOn401: true,
    });
  },
  getSharedWithMe: async (): Promise<CouponRow[]> => {
    return apiFetchJson<CouponRow[]>(`${BASE_URL}/coupons/shared-with-me`, {}, {
      defaultError: 'Paylasilan kuponlar alinamadi',
      redirectOn401: true,
    });
  },
  saveCoupon: async (type: string, week: string, data: any): Promise<CouponRow> => {
    return apiFetchJson<CouponRow>(`${BASE_URL}/coupons`, {
      method: 'POST',
      body: JSON.stringify({ type, week, data })
    }, {
      defaultError: 'Kupon kaydedilemedi',
      redirectOn401: true,
    });
  },
  deleteCoupon: async (id: number): Promise<void> => {
    await apiFetchJson(`${BASE_URL}/coupons/${id}`, { method: 'DELETE' }, {
      defaultError: 'Kupon silinemedi',
      redirectOn401: true,
    });
  },
  shareCoupon: async (id: number, recipient: string, message?: string): Promise<{ success: boolean; recipient: { id: number; username: string } }> => {
    return apiFetchJson(`${BASE_URL}/coupons/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ recipient, message }),
    }, {
      defaultError: 'Kupon paylasilamadi',
      redirectOn401: true,
    });
  },
};
