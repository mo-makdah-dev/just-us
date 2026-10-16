import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
let running = 0;
const waiting: Array<() => void> = [];
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  const start = () => {
    running++;
    scrypt(password, salt, 64, options, (error, key) => {
      running--; waiting.shift()?.();
      if (error) reject(error); else resolve(key);
    });
  };
  if (running < 2) start();
  else if (waiting.length < 8) waiting.push(start);
  else reject(new Error('Password service is busy.'));
});
export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
const dummy = `scrypt-v1:${'0'.repeat(32)}:${'0'.repeat(128)}`;
export async function passwordMatches(password: string, stored?: string | null) {
  const [version, salt, encoded] = (stored || dummy).split(':');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(encoded, 'hex')) && !!stored;
}
