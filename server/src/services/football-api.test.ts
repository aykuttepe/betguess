import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {
  fetchFootballApi,
  FootballApiNotFoundError,
  FootballApiUpstreamError,
  __testables,
} from './football-api';

test('getFootballApiBaseUrl trims trailing slashes', () => {
  const original = process.env.FOOTBALL_API_URL;
  process.env.FOOTBALL_API_URL = 'http://localhost:8000///';
  assert.equal(__testables.getFootballApiBaseUrl(), 'http://localhost:8000');
  process.env.FOOTBALL_API_URL = original;
});

test('fetchFootballApi maps 404 to FootballApiNotFoundError', async () => {
  const originalGet = axios.get;
  (axios as any).get = async () => {
    throw {
      response: {
        status: 404,
        data: { detail: 'Bulunamadi' },
      },
    };
  };

  try {
    await assert.rejects(() => fetchFootballApi('/api/test'), FootballApiNotFoundError);
  } finally {
    (axios as any).get = originalGet;
  }
});

test('fetchFootballApi maps 500 to FootballApiUpstreamError', async () => {
  const originalGet = axios.get;
  (axios as any).get = async () => {
    throw {
      response: {
        status: 500,
        data: { detail: 'Upstream hata' },
      },
    };
  };

  try {
    await assert.rejects(() => fetchFootballApi('/api/test'), FootballApiUpstreamError);
  } finally {
    (axios as any).get = originalGet;
  }
});
