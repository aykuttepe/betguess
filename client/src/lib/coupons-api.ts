import { apiFetchJson } from './http';

export interface CouponRow {
  id: number;
  user_id: number;
  type: 'otomatik' | 'kayitli';
  week: string;
  data: string;
  created_at: string;
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
  }
};
