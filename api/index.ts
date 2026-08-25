import app, { ensureDbLoaded } from '../server.ts';

export default async function handler(req: any, res: any) {
  try {
    await ensureDbLoaded();

    // Ensure URL matches Express router if /api prefix was stripped by Vercel rewrite
    if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/api/')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Function Top-Level Error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel Serverless Error: ' + (err?.message || err)
      });
    }
  }
}
