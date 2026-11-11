/* Cloudflare Worker: receives the form, checks it again, and sends you a
   WhatsApp message through the Meta WhatsApp Cloud API.
   Secrets (WA_TOKEN) are set in Cloudflare, never in the website files. */
export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://mohameed-sami11.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || url.pathname !== '/lead') return json({ ok: false, error: 'Not found' }, 404);
    if (request.headers.get('Origin') !== origin) return json({ ok: false, error: 'Origin not allowed' }, 403);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'Bad request' }, 400);
    }

    // Honeypot: a bot filled the hidden field. Pretend success, send nothing.
    if (body.website) return json({ ok: true });

    // WhatsApp template parameters cannot contain line breaks or long runs of spaces.
    const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 20);
    const service = clean(body.service, 80);
    const description = clean(body.description, 900);
    const digits = phone.replace(/\D/g, '');

    if (name.length < 2 || digits.length < 8 || digits.length > 15 || !service || description.length < 10) {
      return json({ ok: false, error: 'Invalid input' }, 400);
    }

    const when = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const res = await fetch(`https://graph.facebook.com/v21.0/${env.PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: env.OWNER_NUMBER,
        type: 'template',
        template: {
          name: env.TEMPLATE_NAME || 'new_client_request',
          language: { code: env.TEMPLATE_LANG || 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: name },
                { type: 'text', text: phone },
                { type: 'text', text: service },
                { type: 'text', text: description },
                { type: 'text', text: when },
              ],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      console.log('WhatsApp API error', res.status, await res.text());
      return json({ ok: false, error: 'Notification failed' }, 502);
    }
    return json({ ok: true });
  },
};