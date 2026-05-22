/**
 * GET /api/pincode/:pin
 *
 * Server-side proxy to India Post pincode API.
 * api.postalpincode.in has an expired SSL cert — browsers reject it directly.
 * We call it server-to-server with rejectUnauthorized:false to work around this.
 * Returns: { city, district, state } or 404 { error }
 */
import { Router } from 'express';
import https from 'https';

const router = Router();

// Custom agent that ignores the expired cert on api.postalpincode.in
const _agent = new https.Agent({ rejectUnauthorized: false });

router.get('/:pin', async (req, res, next) => {
  try {
    const { pin } = req.params;
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN — must be exactly 6 digits' });
    }

    const data = await new Promise((resolve, reject) => {
      const request = https.get(
        `https://api.postalpincode.in/pincode/${pin}`,
        { agent: _agent, timeout: 6000 },
        (resp) => {
          let body = '';
          resp.on('data', chunk => (body += chunk));
          resp.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (_) { reject(new Error('Bad response from India Post API')); }
          });
        }
      );
      request.on('error', reject);
      request.on('timeout', () => { request.destroy(); reject(new Error('India Post API timeout')); });
    });

    if (
      !Array.isArray(data) ||
      !data[0] ||
      data[0].Status !== 'Success' ||
      !Array.isArray(data[0].PostOffice) ||
      !data[0].PostOffice.length
    ) {
      return res.status(404).json({ error: 'PIN not found in India Post records' });
    }

    const po = data[0].PostOffice[0];
    return res.json({
      city:     po.Block || po.Division || po.Name || po.District || '',
      district: po.District || '',
      state:    po.State   || '',
    });

  } catch (err) {
    // Don't crash the server — just tell the client the lookup failed
    return res.status(502).json({ error: 'Pincode lookup failed: ' + err.message });
  }
});

export default router;
