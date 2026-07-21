/**
 * POST /api/report handler
 *
 * Receives form submissions from the reportar-problema page.
 * Validates the payload, stores in R2 (if configured), and sends email notification.
 */

import { type Env, jsonResponse, errorResponse } from '../index';
import { validateReportPayload } from '../utils/validate';
import { checkRateLimit } from '../utils/rateLimit';

// Generous for the form's text fields; well under Workers' own request-size
// limits. Enforced before JSON.parse via Content-Length and a bounded
// stream read (a spoofed/missing Content-Length can't bypass this).
const MAX_BODY_BYTES = 20_000;

// Idempotency window: a client retry (double submit, network retry) within
// this many seconds gets back the original report's id instead of creating
// a second record.
const IDEMPOTENCY_WINDOW_SECONDS = 600;

export async function handleReport(request: Request, env: Env): Promise<Response> {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (env.RATE_LIMIT_KV) {
    const rateLimit = await checkRateLimit(env.RATE_LIMIT_KV, clientIp);
    if (!rateLimit.allowed) {
      return errorResponse('Demasiadas solicitudes. Intente nuevamente más tarde.', 429);
    }
  }

  const bodyText = await readBoundedBody(request, MAX_BODY_BYTES);
  if (bodyText === null) {
    return errorResponse('El cuerpo de la solicitud excede el límite permitido', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return errorResponse('El cuerpo de la solicitud debe ser JSON válido', 400);
  }

  const validation = validateReportPayload(body);
  if (!validation.valid) {
    return errorResponse(`Datos inválidos: ${validation.errors.join('; ')}`, 422);
  }

  const data = body as Record<string, unknown>;
  const idempotencyKey = `idempotency:${await sha256Hex(bodyText)}`;

  // Idempotency: a retry of the exact same payload within the window
  // returns the original report's id instead of creating a duplicate.
  if (env.RATE_LIMIT_KV) {
    const existingId = await env.RATE_LIMIT_KV.get(idempotencyKey);
    if (existingId) {
      return jsonResponse(
        {
          message:
            'Reporte recibido. Gracias por ayudarnos a mantener la precisión de Noticiencias.',
          id: existingId,
        },
        201
      );
    }
  }

  const timestamp = new Date().toISOString();

  const record = {
    id: crypto.randomUUID(),
    problem_type: data.problem_type,
    article_url: data.article_url || null,
    description: data.description || null,
    content_snippet: data.content_snippet || null,
    evidence_url: data.evidence_url || null,
    tech_browser: data.tech_browser || null,
    tech_os: data.tech_os || null,
    reporter_email: data.reporter_email || null,
    submitted_at: timestamp,
    environment: env.ENVIRONMENT,
    user_agent: request.headers.get('User-Agent') || null,
  };

  // Track whether at least one durable sink actually succeeded — the
  // response must never claim success it didn't achieve.
  let storedDurably = false;

  if (env.REPORT_BUCKET) {
    try {
      const key = `reports/${record.submitted_at.slice(0, 10)}/${record.id}.json`;
      await env.REPORT_BUCKET.put(key, JSON.stringify(record, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
      storedDurably = true;
    } catch (err) {
      console.error('Failed to store report in R2:', err);
    }
  }

  let emailSent = false;
  if (env.EMAIL_API_KEY && env.EMAIL_FROM && env.EMAIL_TO) {
    const emailBody = buildEmailBody(record);
    try {
      await sendEmail(env, emailBody);
      emailSent = true;
    } catch (err) {
      console.error('Failed to send email notification:', err);
    }
  }

  if (!storedDurably && !emailSent) {
    // Nothing durable happened — do not tell the reporter it worked, and
    // don't record an idempotency entry for a report that doesn't exist
    // anywhere, so a genuine retry can try again.
    return errorResponse(
      'No se pudo registrar el reporte de forma duradera. Intente nuevamente más tarde.',
      503
    );
  }

  if (env.RATE_LIMIT_KV) {
    await env.RATE_LIMIT_KV.put(idempotencyKey, record.id, {
      expirationTtl: IDEMPOTENCY_WINDOW_SECONDS,
    });
  }

  console.log(
    `[report] type=${record.problem_type} article=${record.article_url || 'none'} id=${record.id} ` +
      `r2=${storedDurably} email=${emailSent}`
  );

  return jsonResponse(
    {
      message: 'Reporte recibido. Gracias por ayudarnos a mantener la precisión de Noticiencias.',
      id: record.id,
    },
    201
  );
}

// ---------------------------------------------------------------------------
// Request body bounds
// ---------------------------------------------------------------------------

/**
 * Read the request body up to `maxBytes`, returning null if it's larger.
 * Checks Content-Length first (cheap rejection) but always enforces the
 * bound on the actual stream too, since Content-Length can be absent or
 * understated.
 */
async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > maxBytes) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(buffer);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

function buildEmailBody(record: Record<string, unknown>): string {
  return [
    `Tipo: ${record.problem_type}`,
    `Artículo: ${record.article_url || 'No especificado'}`,
    `Descripción: ${record.description || 'No proporcionada'}`,
    `Fragmento: ${record.content_snippet || 'No proporcionado'}`,
    `Evidencia: ${record.evidence_url || 'No proporcionada'}`,
    `Navegador: ${record.tech_browser || 'No especificado'}`,
    `SO: ${record.tech_os || 'No especificado'}`,
    `Contacto: ${record.reporter_email || 'Anónimo'}`,
    `Enviado: ${record.submitted_at}`,
    `ID: ${record.id}`,
  ].join('\n');
}

async function sendEmail(env: Env, body: string): Promise<void> {
  // Generic email dispatch via fetch to a mail service API.
  // Replace with SendGrid, Mailgun, Resend, or your preferred provider.
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.EMAIL_TO }] }],
      from: { email: env.EMAIL_FROM },
      subject: `[Noticiencias] Nuevo reporte: ${body.split('\n')[0]}`,
      content: [{ type: 'text/plain', value: body }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Email API returned ${response.status}`);
  }
}
