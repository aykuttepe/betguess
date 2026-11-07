import { isIP } from 'node:net';
import { Express } from 'express';

// Trust addresses, never an arbitrary hop count: direct clients cannot supply their own IP.
export function trustedProxyAddresses(value = process.env.TRUST_PROXY): string[] | false {
  if (!value?.trim()) return false;
  const addresses = value.split(',').map(address => address.trim());
  for (const address of addresses) {
    const [ip, prefix, extra] = address.split('/');
    const version = isIP(ip);
    if (!version || extra !== undefined || (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128) || Number(prefix) === 0))) {
      throw new Error('TRUST_PROXY must contain explicit proxy IP addresses or CIDRs (not true or hop counts).');
    }
  }
  return addresses;
}

export function configureTrustProxy(app: Express): void {
  app.set('trust proxy', trustedProxyAddresses());
}
