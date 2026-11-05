import { apiFetchJson } from './http';

const BASE_URL = '/api';

export interface FriendUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface FriendRequest {
  id: number;
  requester_id: number;
  recipient_id: number;
  requester_username: string;
  recipient_username: string;
  status: string;
  created_at: string;
  responded_at: string | null;
}

export interface FriendRequestsResponse {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface FriendSearchResult {
  id: number;
  username: string;
  relationship: 'none' | 'friend' | 'incoming' | 'outgoing' | 'self';
}

export const friendsApi = {
  getFriends: async (): Promise<FriendUser[]> => {
    return apiFetchJson<FriendUser[]>(`${BASE_URL}/friends`, {}, {
      defaultError: 'Arkadaslar alinamadi',
      redirectOn401: true,
    });
  },
  searchUsers: async (query: string): Promise<FriendSearchResult[]> => {
    return apiFetchJson<FriendSearchResult[]>(`${BASE_URL}/friends/search?q=${encodeURIComponent(query)}`, {}, {
      defaultError: 'Kullanici aramasi yapilamadi',
      redirectOn401: true,
    });
  },
  getRequests: async (): Promise<FriendRequestsResponse> => {
    return apiFetchJson<FriendRequestsResponse>(`${BASE_URL}/friends/requests`, {}, {
      defaultError: 'Arkadaslik istekleri alinamadi',
      redirectOn401: true,
    });
  },
  sendRequest: async (recipient: string): Promise<void> => {
    await apiFetchJson(`${BASE_URL}/friends/requests`, {
      method: 'POST',
      body: JSON.stringify({ recipient }),
    }, {
      defaultError: 'Arkadaslik istegi gonderilemedi',
      redirectOn401: true,
    });
  },
  respondRequest: async (requestId: number, action: 'accept' | 'decline'): Promise<void> => {
    await apiFetchJson(`${BASE_URL}/friends/requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }, {
      defaultError: 'Arkadaslik istegi yanitlanamadi',
      redirectOn401: true,
    });
  },
  removeFriend: async (friendId: number): Promise<void> => {
    await apiFetchJson(`${BASE_URL}/friends/${friendId}`, { method: 'DELETE' }, {
      defaultError: 'Arkadas silinemedi',
      redirectOn401: true,
    });
  },
};
