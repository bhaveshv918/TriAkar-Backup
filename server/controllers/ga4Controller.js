// GA4 Traffic Analytics (A14) — reads the Google Analytics Data API with a
// service account and returns a compact overview for the admin dashboard.
// Config (Render env): GA4_SA_JSON = full service-account JSON, GA4_PROPERTY_ID = numeric property id.
import { BetaAnalyticsDataClient } from '@google-analytics/data';

let _client = null, _propertyId = null, _initErr = null, _tried = false;

function getClient() {
  if (_tried) return _client;
  _tried = true;
  try {
    const raw = process.env.GA4_SA_JSON;
    _propertyId = (process.env.GA4_PROPERTY_ID || '').trim();
    if (!raw || !_propertyId) {
      _initErr = 'GA4 not configured — set GA4_SA_JSON and GA4_PROPERTY_ID in the environment.';
      return null;
    }
    const creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, '\n'); // tolerate escaped newlines
    _client = new BetaAnalyticsDataClient({
      credentials: { client_email: creds.client_email, private_key: creds.private_key },
      projectId: creds.project_id,
    });
    return _client;
  } catch (e) {
    _initErr = 'GA4 credentials invalid: ' + e.message;
    return null;
  }
}

const sumCol = (report, i) => (report.rows || []).reduce((a, r) => a + Number(r.metricValues[i].value || 0), 0);

export async function getGa4Overview(req, res) {
  const client = getClient();
  if (!client) return res.status(503).json({ error: _initErr || 'GA4 not configured' });

  const property = `properties/${_propertyId}`;
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 28));
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  try {
    const [[trend], [top], [channels], [devices]] = await Promise.all([
      client.runReport({ property, dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      client.runReport({ property, dateRanges,
        dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
      client.runReport({ property, dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 }),
      client.runReport({ property, dateRanges,
        dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
    ]);

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      days,
      totals: { users: sumCol(trend, 0), sessions: sumCol(trend, 1), pageViews: sumCol(trend, 2) },
      trend: (trend.rows || []).map(r => ({
        date: r.dimensionValues[0].value,
        users: Number(r.metricValues[0].value || 0),
        sessions: Number(r.metricValues[1].value || 0),
        pageViews: Number(r.metricValues[2].value || 0),
      })),
      topPages: (top.rows || []).map(r => ({ path: r.dimensionValues[0].value, views: Number(r.metricValues[0].value || 0) })),
      channels: (channels.rows || []).map(r => ({ channel: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value || 0) })),
      devices: (devices.rows || []).map(r => ({ device: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value || 0) })),
    });
  } catch (e) {
    console.error('GA4 report error:', e.message);
    const m = e.message || '';
    const friendly =
      /permission|PERMISSION_DENIED|403/i.test(m) ? 'GA4 denied access — grant the service account "Viewer" on the property.'
      : /has not been used|disabled|SERVICE_DISABLED|API .* not enabled/i.test(m) ? 'Enable the "Google Analytics Data API" in the service account\'s Google Cloud project.'
      : /INVALID_ARGUMENT|property/i.test(m) ? 'Check GA4_PROPERTY_ID — it must be the numeric Property ID (Admin → Property Settings).'
      : 'GA4 fetch failed: ' + m;
    res.status(502).json({ error: friendly });
  }
}
