// Generates identifiers like MDNA-84-VF4-7A92K
// Uses crypto.randomInt for CSPRNG-quality randomness (not Math.random()).
import { randomInt } from 'crypto';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';

function randChars(source, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += source[randomInt(source.length)];
  return out;
}

function randDigits(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += String(randomInt(10));
  return out;
}

export function generatePublicId({ year, model } = {}) {
  const yy = year ? String(year).slice(-2) : randDigits(2);
  let modelPart = '';
  if (model) {
    const cleaned = String(model).toUpperCase().replace(/[^A-Z0-9]/g, '');
    modelPart = (cleaned.slice(0, 3) || randChars(ALPHA, 3)).padEnd(3, 'X').slice(0, 3);
  } else {
    modelPart = randChars(ALPHA, 3);
  }
  const suffix = randChars(ALNUM, 5);
  return `MDNA-${yy}-${modelPart}-${suffix}`;
}

export function generateTagUid() {
  return 'TAG-' + randChars(ALNUM, 12);
}

export function generatePublicToken() {
  return randChars(ALNUM, 24);
}

export function generateTransferCode() {
  return randChars(ALNUM, 8);
}
