import express, { type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { AppError, hash, Rooms } from './rooms.js';
import type { Storage } from './storage.js';
import { googleOAuth, type GoogleConfig } from './oauth.js';
import { z } from 'zod';

type Settings = { origin: string; production?: boolean; trustProxy?: number; frontend?: string; clock?: () => number; google?: GoogleConfig; testAuthIpLimit?: number };
export async function createApplication(storage: Storage, settings: Settings) {
  const oauth = googleOAuth(settings.google, settings.origin);
  const rooms = new Rooms(storage, settings.clock, oauth.configured);
  await rooms.init();
  const app = express();
  app.disable('x-powered-by');
  if (settings.trustProxy) app.set('trust proxy', settings.trustProxy);
  const http = createServer(app);
  app.use((req, res, next) => {
    if (!storage.assertOwnership || (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/'))) return next();
    void storage.assertOwnership().then(() => next()).catch(() => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Retry-After', '2');
      res.status(503).json({ ok: false, error: { code: 'SERVER_RESTARTING', message: 'Our space is reconnecting. Please try again in a moment.' } });
    });
  });
  http.requestTimeout = 15000;
  http.headersTimeout = 10000;
  http.keepAliveTimeout = 5000;
  const counts = new Map<string, { count: number; until: number }>();
  function limit(key: string, max: number, ms: number) {
    const now = Date.now();
    let value = counts.get(key);
    if (!value || value.until <= now) { value = { count: 0, until: now + ms }; counts.set(key, value); }
    if (++value.count > max) throw new AppError('RATE_LIMIT', 'A little too fast. Please wait a moment and try again.', 429);
    if (counts.size > 10000) for (const [key, v] of counts) if (v.until <= now) counts.delete(key);
    if (counts.size > 20000) throw new AppError('BUSY', 'Please try again shortly.', 503);
  }
  const errorBody = (error: unknown) => {
    if (error instanceof ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Please check your details.' } };
    if (error instanceof AppError) return { ok: false as const, error: { code: error.code, message: error.message } };
    console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error');
    return { ok: false as const, error: { code: 'SERVER_ERROR', message: 'We could not save that change. Please try again.' } };
  };
  const tokenFrom = (cookie?: string) => cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('just_us='))?.slice(8);
  const sessionFrom = (req: Request) => {
    const token = tokenFrom(req.headers.cookie);
    if (!token || !rooms.validSession(hash(token))) throw new AppError('SESSION_EXPIRED', 'Refresh the page to reconnect.', 401);
    return hash(token);
  };
  const setSession = (res: Response, token: string) => res.cookie('just_us', token, { httpOnly: true, secure: !!settings.production, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
  const authResult = (res: Response, auth: { token: string; sessionId: string; recoveryCode?: string }) => {
    setSession(res, auth.token); res.json({ ok: true, data: { ...rooms.view(auth.sessionId), ...(auth.recoveryCode ? { recoveryCode: auth.recoveryCode } : {}) } });
  };
  app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (settings.production) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    }
    next();
  });
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'just-us' }));
  app.get('/ready', async (_req, res) => {
    try { await storage.load(); res.json({ ok: true, storage: storage.kind }); }
    catch { res.status(503).json({ ok: false }); }
  });
  app.get('/auth/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const flowCookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('just_us_oauth='))?.slice(14);
    res.clearCookie('just_us_oauth', { path: '/auth/callback', httpOnly: true, secure: !!settings.production, sameSite: 'lax' });
    try {
      const identity = await oauth.finish(flowCookie, req.query.error ? undefined : req.query.code);
      if (!rooms.validSession(identity.sessionId)) throw new AppError('OAUTH_EXPIRED', 'Your original session expired.');
      const auth = await rooms.googleLogin(identity.sessionId, identity.subject, identity.name);
      setSession(res, auth.token);
      res.redirect(303, '/?auth=success');
    } catch (e) {
      const reason = e instanceof AppError && ['ACCOUNT_IN_USE', 'ROOM_CONFLICT'].includes(e.code) ? 'conflict' : req.query.error ? 'cancelled' : 'failed';
      res.redirect(303, `/?auth=${reason}`);
    }
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      limit(`api:${req.ip}`, 180, 60000);
      if ((req.headers.origin && req.headers.origin !== settings.origin) || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('ORIGIN', 'Open this page directly to continue.', 403);
      if (req.method !== 'GET' && req.headers.origin !== settings.origin) throw new AppError('ORIGIN', 'This request is not from this website.', 403);
      next();
    } catch (e) { next(e); }
  });
  app.use('/api', express.json({ limit: '12kb', strict: true }));
  app.get('/api/session', async (req, res) => {
    const auth = await rooms.authenticate(tokenFrom(req.headers.cookie));
    setSession(res, auth.token);
    await rooms.sweep();
    res.json({ ok: true, data: rooms.view(auth.sessionId) });
  });
  app.use('/api', (req, _res, next) => {
    try {
      const sessionId = sessionFrom(req);
      if (req.method !== 'GET' && !rooms.validCsrf(sessionId, req.headers['x-csrf-token'])) throw new AppError('CSRF', 'Your page is out of date. Refresh and try again.', 403);
      next();
    } catch (e) { next(e); }
  });
  app.use('/api/auth', (req, _res, next) => {
    try { limit(`auth:${req.ip}`, settings.production ? 12 : settings.testAuthIpLimit ?? 12, 600000); limit(`auth-session:${sessionFrom(req)}`, 12, 600000); next(); } catch (e) { next(e); }
  });
  app.post('/api/auth/signup', async (req, res) => authResult(res, await rooms.signup(sessionFrom(req), req.body)));
  app.post('/api/auth/login', async (req, res) => authResult(res, await rooms.login(sessionFrom(req), req.body)));
  app.post('/api/auth/logout', async (req, res) => authResult(res, await rooms.logout(sessionFrom(req))));
  app.post('/api/auth/sign-out-others', async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    authResult(res, await rooms.signOutOthers(sessionFrom(req)));
  });
  app.post('/api/account/export', async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    limit(`export:${sessionFrom(req)}`, 3, 60000);
    await rooms.settled(); res.json({ ok: true, data: rooms.exportAccount(sessionFrom(req)) });
  });
  app.post('/api/auth/recover', async (req, res) => authResult(res, await rooms.recover(sessionFrom(req), req.body)));
  app.post('/api/auth/password', async (req, res) => authResult(res, await rooms.changePassword(sessionFrom(req), req.body)));
  app.post('/api/auth/recovery-key', async (req, res) => res.json({ ok: true, data: await rooms.recoveryKey(sessionFrom(req), req.body) }));
  app.get('/api/people', async (req, res) => { await rooms.settled(); res.json({ ok: true, data: rooms.people(sessionFrom(req)) }); });
  app.post('/api/people/preview', async (req, res) => {
    await rooms.settled();
    const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).strict().parse(req.body);
    res.json({ ok: true, data: rooms.previewConnection(sessionFrom(req), token) });
  });
  app.post('/api/people', async (req, res) => {
    limit(`people:${sessionFrom(req)}`, 30, 60000);
    res.json({ ok: true, data: await rooms.peopleAction(sessionFrom(req), req.body) });
  });
  app.post('/api/auth/google', async (req, res) => {
    const flow = await oauth.start(sessionFrom(req));
    res.cookie('just_us_oauth', flow.id, { httpOnly: true, secure: !!settings.production, sameSite: 'lax', maxAge: 10 * 60000, path: '/auth/callback' });
    res.json({ ok: true, data: { url: flow.url } });
  });
  app.post('/api/profile', async (req, res) => res.json({ ok: true, data: await rooms.saveProfile(sessionFrom(req), req.body) }));
  app.get('/api/saved-rooms', async (req, res) => { await rooms.settled(); res.json({ ok: true, data: rooms.directory(sessionFrom(req)) }); });
  app.post('/api/saved-rooms', async (req, res) => {
    limit(`saved:${sessionFrom(req)}`, 30, 60000);
    res.json({ ok: true, data: await rooms.savedAction(sessionFrom(req), req.body) });
  });
  app.post('/api/auth/delete', async (req, res) => {
    z.object({ confirm: z.literal('DELETE') }).strict().parse(req.body);
    authResult(res, await rooms.deleteAccount(sessionFrom(req)));
  });
  app.post('/api/rooms', async (req, res) => {
    const account = rooms.view(sessionFrom(req)).account;
    limit(`create:${account?.id || req.ip}`, account ? 20 : 5, 600000);
    res.json({ ok: true, data: await rooms.create(sessionFrom(req), req.body) });
  });
  app.post('/api/join', async (req, res) => {
    limit(`join:${req.ip}`, 10, 60000);
    res.json({ ok: true, data: await rooms.join(sessionFrom(req), req.body) });
  });
  app.post('/api/command', async (req, res) => {
    if (req.body?.type === 'chat') limit(`chat:${sessionFrom(req)}`, 5, 10000);
    limit(`action:${sessionFrom(req)}`, 20, 1000);
    res.json({ ok: true, data: await rooms.command(sessionFrom(req), req.body) });
  });
  app.use('/api', (_req, _res, next) => next(new AppError('NOT_FOUND', 'Unknown request.', 404)));
  app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const malformed = error instanceof SyntaxError || (error as { type?: string })?.type === 'entity.too.large';
    if (malformed) { res.status(400).json({ ok: false, error: { code: 'INVALID_INPUT', message: 'That request could not be read.' } }); return; }
    res.status(error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500).json(errorBody(error));
  });
  if (settings.frontend) {
    app.use(express.static(settings.frontend, { index: false }));
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: settings.frontend }));
  }
  const io = new Server(http, {
    maxHttpBufferSize: 8192,
    cors: { origin: settings.origin, credentials: true },
    allowRequest: (req, callback) => callback(null, req.headers.origin === settings.origin),
    // No packet recovery cache: every reconnect receives a new authorized projection.
    transports: ['websocket'],
    pingInterval: 5000,
    pingTimeout: 5000,
  });
  io.use(async (socket, next) => {
    if (settings.production && socket.handshake.auth.protocolVersion !== 4) return next(new Error('Just Us has been updated. Refresh this page to continue.'));
    try { await storage.assertOwnership?.(); }
    catch {
      return next(Object.assign(new Error('Our space is reconnecting. Please wait a moment.'), { data: { code: 'SERVER_RESTARTING' } }));
    }
    try {
      const token = tokenFrom(socket.request.headers.cookie);
      const sessionId = token ? hash(token) : '';
      limit(`handshake:${socket.handshake.address}`, 60, 60000);
      if (socket.handshake.headers.origin !== settings.origin || !rooms.validCsrf(sessionId, socket.handshake.auth.csrf)) throw new AppError('SESSION_EXPIRED', 'Refresh the page to reconnect.', 401);
      socket.data.sessionId = sessionId;
      next();
    } catch (e) { next(new Error(errorBody(e).error.message)); }
  });
  const broadcast = () => {
    if (storage.active === false) return;
    for (const socket of io.sockets.sockets.values()) if (socket.data.joined) {
      try { socket.emit('session', rooms.view(socket.data.sessionId)); }
      catch { socket.emit('sessionError', 'Your session expired. Refresh to continue.'); socket.disconnect(true); }
    }
  };
  rooms.onChange = broadcast;
  io.on('connection', socket => {
    const sessionId: string = socket.data.sessionId;
    // Register disconnect immediately; it must also handle a disconnect during async setup.
    let setup: Promise<void>;
    socket.on('disconnect', () => { void setup?.then(() => rooms.disconnect(sessionId, socket.id)).catch(() => {}); });
    setup = rooms.connect(sessionId, socket.id).then(() => {
      if (!socket.connected) return;
      socket.data.joined = true;
      socket.emit('session', rooms.view(sessionId));
    }).catch(error => {
      socket.emit('sessionError', errorBody(error).error.message);
      socket.disconnect(true);
    });
    socket.on('command', async (input: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      try {
        if (!socket.data.joined) throw new AppError('NOT_READY', 'Wait for the room to connect.');
        limit(`action:${sessionId}`, 20, 1000);
        if ((input as { type?: string })?.type === 'chat') limit(`chat:${sessionId}`, 5, 10000);
        const data = await rooms.command(sessionId, input);
        ack({ ok: true, data });
      } catch (e) { ack(errorBody(e)); }
    });
  });
  const sweeper = setInterval(() => { if (storage.active !== false) void rooms.sweep().catch(() => console.error('Room cleanup could not be saved.')); }, 15000);
  sweeper.unref();
  let checking = false;
  const ownership = storage.assertOwnership ? setInterval(() => {
    if (checking || storage.active === false) return;
    checking = true;
    void storage.assertOwnership!().catch(() => {
      if (storage.active === false) {
        // A transport close retries automatically; a server disconnect packet would not.
        for (const socket of io.sockets.sockets.values()) socket.conn.close();
      }
    }).finally(() => { checking = false; });
  }, 1000) : undefined;
  ownership?.unref();
  return { app, http, rooms, io, async close() {
    clearInterval(sweeper);
    clearInterval(ownership);
    await new Promise<void>(resolve => io.close(() => resolve()));
    try { if (storage.active !== false) await rooms.sweep(); }
    finally { await storage.close(); }
  } };
}
