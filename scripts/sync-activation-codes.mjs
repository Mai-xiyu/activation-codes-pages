import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.ACTIVATION_CODES_ENDPOINT;
const token = process.env.ACTIVATION_CODES_TOKEN;
const outputFile = path.join(process.cwd(), 'data', 'activation-codes.json');

if (!endpoint) {
  throw new Error('Missing ACTIVATION_CODES_ENDPOINT secret');
}

const headers = {
  Accept: 'application/json',
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const response = await fetch(endpoint, { headers });
if (!response.ok) {
  throw new Error(`Activation code endpoint returned HTTP ${response.status}`);
}

const payload = await response.json();
const rawCodes = Array.isArray(payload) ? payload : (payload.codes || payload.data || payload.items || []);

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStatus(value) {
  const raw = asText(value || 'active').toLowerCase();
  if (['used', 'consumed', 'redeemed'].includes(raw)) return 'used';
  if (['expired', 'timeout'].includes(raw)) return 'expired';
  if (['revoked', 'disabled', 'blocked', 'cancelled', 'canceled'].includes(raw)) return 'revoked';
  return 'active';
}

function sanitizeCode(entry) {
  const code = asText(entry.code || entry.activationCode || entry.licenseCode || entry.key);
  if (!code) return null;

  return {
    code,
    status: normalizeStatus(entry.status),
    plan: asText(entry.plan || entry.tier || entry.product),
    label: asText(entry.label || entry.note || entry.remark),
    issuedAt: asText(entry.issuedAt || entry.createdAt || entry.issued_at),
    expiresAt: asText(entry.expiresAt || entry.expiredAt || entry.expires_at),
    maxUses: asNumber(entry.maxUses || entry.max_uses),
    remainingUses: asNumber(entry.remainingUses || entry.remaining_uses),
    usedCount: asNumber(entry.usedCount || entry.used_count),
  };
}

const publicCodes = rawCodes
  .map(sanitizeCode)
  .filter(Boolean)
  .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)) || a.code.localeCompare(b.code));

const output = {
  schema: 1,
  updatedAt: new Date().toISOString(),
  publicFields: ['code', 'status', 'plan', 'label', 'issuedAt', 'expiresAt', 'maxUses', 'remainingUses', 'usedCount'],
  codes: publicCodes,
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${publicCodes.length} public activation codes to ${outputFile}`);
