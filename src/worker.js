// Serves the static site from ./public and handles the contact form at POST /api/contact.
// The form is emailed through Resend so the inbox address never reaches the browser.

const ALLOWED_HOSTS = ['johandejong.eu', 'www.johandejong.eu', 'johanwebsite.johandejong.workers.dev'];
const ABOUT = ['A role', 'A project', 'Something else'];
const MIN_FILL_MS = 3000; // humans take longer than this to fill the form
const LIMITS = { name: 200, email: 320, message: 5000 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);

  const origin = request.headers.get('Origin');
  const host = origin ? safeHost(origin) : null;
  if (!host || !(ALLOWED_HOSTS.includes(host) || host.endsWith('-johanwebsite.johandejong.workers.dev'))) {
    return json({ ok: false, error: 'Not allowed.' }, 403);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Could not read the form.' }, 400);
  }

  // Spam traps: a hidden field only bots fill in, and a minimum time on the page.
  // Bots get a normal-looking success so they don't learn to adapt.
  const startedAt = Number(form.get('started_at'));
  if (field(form, 'website') || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ ok: true });
  }

  const name = field(form, 'name');
  const email = field(form, 'email');
  const message = field(form, 'message');
  const about = ABOUT.includes(field(form, 'about')) ? field(form, 'about') : 'Something else';

  if (!name || !email || !message) return json({ ok: false, error: 'Please fill in your name, email and message.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'That email address does not look right.' }, 400);
  if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) {
    return json({ ok: false, error: 'Your note is a bit too long. Please shorten it.' }, 400);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
    console.error('Contact form is missing RESEND_API_KEY or CONTACT_TO');
    return json({ ok: false, error: 'The form is not set up yet. Please try again later.' }, 503);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.CONTACT_TO],
      reply_to: email,
      subject: `Website note from ${oneLine(name)} (${about})`,
      text: `Name: ${name}\nEmail: ${email}\nAbout: ${about}\n\n${message}\n`,
    }),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ ok: false, error: 'Your note could not be sent. Please try again later.' }, 502);
  }
  return json({ ok: true });
}

function field(form, key) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function oneLine(text) {
  return text.replace(/[\r\n]+/g, ' ').slice(0, 80);
}

function safeHost(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
