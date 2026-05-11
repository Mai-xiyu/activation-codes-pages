import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.ACTIVATION_CODES_ENDPOINT;
const token = process.env.ACTIVATION_CODES_TOKEN;
const method = (process.env.ACTIVATION_CODES_METHOD || 'POST').toUpperCase();
const requestBody = process.env.ACTIVATION_CODES_BODY || '{}';
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

const request = { headers, method };
if (method !== 'GET' && method !== 'HEAD') {
  headers['Content-Type'] = 'application/json';
  request.body = requestBody;
}

const response = await fetch(endpoint, request);
if (!response.ok) {
  throw new Error(`Activation code endpoint returned HTTP ${response.status}`);
}

const payload = await response.json();
if (payload && payload.ok === false) {
  throw new Error(`Activation code endpoint rejected request: ${payload.error || 'unknown error'}`);
}
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
  const raw = asText(value).toLowerCase();
  if (['unused', 'available', '未使用', '可用'].includes(raw)) return 'active';
  if (['used', 'consumed', 'redeemed'].includes(raw)) return 'used';
  if (['expired', 'timeout'].includes(raw)) return 'expired';
  if (['revoked', 'disabled', 'blocked', 'cancelled', 'canceled'].includes(raw)) return 'revoked';
  return '';
}

function millisToIso(value) {
  const millis = asNumber(value);
  if (millis === null || millis <= 0) return '';
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function deriveStatus(entry, expiresAt) {
  const explicit = normalizeStatus(entry.status);
  if (explicit) return explicit;
  if (expiresAt) {
    const expires = new Date(expiresAt).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) return 'expired';
  }
  return entry.device_id || entry.deviceId ? 'used' : 'active';
}

function sanitizeCode(entry) {
  const code = asText(entry.code || entry.activationCode || entry.licenseCode || entry.key);
  if (!code) return null;

  const durationDays = asNumber(entry.duration_days || entry.durationDays || entry.days);
  const activatedAt = asNumber(entry.activated_at || entry.activatedAt);
  const generatedAt = asText(entry.issuedAt || entry.createdAt || entry.created_at || entry.generatedAt);
  const issuedAt = generatedAt || '';
  const computedExpiresAt = activatedAt && durationDays
    ? millisToIso(activatedAt + durationDays * 86400000)
    : '';
  const expiresAt = asText(entry.expiresAt || entry.expiredAt || entry.expires_at) || computedExpiresAt;
  const isBound = Boolean(entry.device_id || entry.deviceId || activatedAt);
  const explicitUsedCount = asNumber(entry.usedCount || entry.used_count);
  const maxUses = asNumber(entry.maxUses || entry.max_uses) ?? 1;

  return {
    code,
    status: deriveStatus(entry, expiresAt),
    plan: asText(entry.plan || entry.tier || entry.product) || (durationDays ? `${durationDays} 天` : ''),
    label: asText(entry.label || entry.note || entry.remark) || (isBound ? '已绑定设备' : '未使用'),
    issuedAt,
    expiresAt,
    maxUses,
    remainingUses: asNumber(entry.remainingUses || entry.remaining_uses) ?? (isBound ? 0 : maxUses),
    usedCount: explicitUsedCount ?? (isBound ? 1 : 0),
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
