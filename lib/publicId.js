// Generates identifiers like MDNA-84-VF4-7A92K
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';

function randChars(source, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += source[Math.floor(Math.random() * source.length)];
  return out;
}

export function generatePublicId({ year, model } = {}) {
  const yy = year ? String(year).slice(-2) : randChars('0123456789', 2);
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
