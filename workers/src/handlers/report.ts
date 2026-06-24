/**
 * POST /api/report handler
 *
 * Receives form submissions from the reportar-problema page.
 * Validates the payload, stores in R2 (if configured), and sends email notification.
 */

import { type Env, jsonResponse, errorResponse, corsHeaders } from '../index';
import { validateReportPayload } from '../utils/validate';

export async function handleReport(request: Request, env: Env): Promise<Response> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('El cuerpo de la solicitud debe ser JSON válido', 400);
  }

  // Validate payload
  const validation = validateReportPayload(body);
  if (!validation.valid) {
    return errorResponse(
      `Datos inválidos: ${validation.errors.join('; ')}`,
      422
    );
  }

  const data = body as Record<string, unknown>;
  const timestamp = new Date().toISOString();

  // Build submission record
  const record = {
    id: crypto.randomUUID(),
    problem_type: data.problem_type,
    article_url: data.article_url || null,
    description: data.description || null,
    evidence_url: data.evidence_url || null,
    reporter_email: data.reporter_email || null,
    submitted_at: timestamp,
    environment: env.ENVIRONMENT,
    user_agent: request.headers.get('User-Agent') || null,
  };

  // Store in R2 if bucket is configured
  if (env.REPORT_BUCKET) {
    try {
      const key = `reports/${record.submitted_at.slice(0, 10)}/${record.id}.json`;
      await env.REPORT_BUCKET.put(key, JSON.stringify(record, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    } catch (err) {
      console.error('Failed to store report in R2:', err);
      // Non-fatal: continue to email notification
    }
  }

  // Send email notification if configured
  if (env.EMAIL_API_KEY && env.EMAIL_FROM && env.EMAIL_TO) {
    const emailBody = buildEmailBody(record);
    try {
      await sendEmail(env, emailBody);
    } catch (err) {
      console.error('Failed to send email notification:', err);
      // Non-fatal: report was accepted
    }
  }

  // Log submission (observability)
  console.log(
    `[report] type=${record.problem_type} article=${record.article_url || 'none'} id=${record.id}`
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
// Email helpers
// ---------------------------------------------------------------------------

function buildEmailBody(record: Record<string, unknown>): string {
  return [
    `Tipo: ${record.problem_type}`,
    `Artículo: ${record.article_url || 'No especificado'}`,
    `Descripción: ${record.description || 'No proporcionada'}`,
    `Evidencia: ${record.evidence_url || 'No proporcionada'}`,
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
