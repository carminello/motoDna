import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET || 'dev_secret';

export async function hashPassword(pw) {
  return await bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw, hash) {
  return await bcrypt.compare(pw, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

export async function getUserFromRequest(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/motodna_token=([^;]+)/);
    let token = match ? match[1] : null;
    if (!token) {
      const auth = request.headers.get('authorization') || '';
      if (auth.startsWith('Bearer ')) token = auth.slice(7);
    }
    if (!token) return null;
    const payload = verifyToken(token);
    return payload;
  } catch (e) {
    return null;
  }
}
