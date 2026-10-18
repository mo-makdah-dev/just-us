import { createServer, type ProxyOptions } from 'vite';
import { resolve } from 'node:path';

// The hosted server remains the only authority for shared room state.
const target = 'https://just-us-c7ee609b.onrender.com';
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port.');
const localOrigin = `http://localhost:${port}`;
const proxy: ProxyOptions = {
  target, changeOrigin: true, secure: true, ws: true,
  configure(upstream) {
    const headers = (request: import('node:http').ClientRequest) => {
      request.setHeader('origin', target);
      request.setHeader('sec-fetch-site', 'same-origin');
      // Never forward client-supplied forwarding headers to the trusted server.
      request.removeHeader('x-forwarded-for');
      request.removeHeader('x-forwarded-host');
      request.removeHeader('x-forwarded-proto');
    };
    upstream.on('proxyReq', headers);
    upstream.on('proxyReqWs', headers);
  },
};
const server = await createServer({
  configFile: resolve('apps/web/vite.config.ts'),
  define: { 'import.meta.env.VITE_LOCAL_ONLINE_DATA': JSON.stringify('true') },
  plugins: [{ name: 'local-online-data', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.headers.host !== `localhost:${port}` && req.headers.host !== `127.0.0.1:${port}`) {
        res.statusCode = 403; res.end('Open the local preview directly.'); return;
      }
      if ((req.headers.origin && ![localOrigin, `http://127.0.0.1:${port}`].includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') {
        res.statusCode = 403; res.end('Foreign origins cannot use the live-data preview.'); return;
      }
      if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, service: 'just-us', mode: 'online-data' })); return;
      }
      if (req.url?.startsWith('/auth/')) {
        res.statusCode = 302; res.setHeader('Location', target + req.url); res.end(); return;
      }
      next();
    });
    server.httpServer?.prependListener('upgrade', (req, socket) => {
      if (![localOrigin, `http://127.0.0.1:${port}`].includes(req.headers.origin || '')) socket.destroy();
    });
  } }],
  server: { host: '127.0.0.1', port, strictPort: true, proxy: { '/api': proxy, '/socket.io': proxy, '/ready': proxy } },
});
await server.listen();
console.log(`Just Us local frontend: ${localOrigin}\nONLINE DATA: sign in with your online account. Changes affect the live database.\nThe hosted server remains active; no database takeover occurs.`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.close().then(() => process.exit(0)); });
