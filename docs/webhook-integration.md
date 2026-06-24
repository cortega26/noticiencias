# Integración del Webhook Backend-Frontend

## Estado actual

La infraestructura de notificación del frontend está implementada y lista:
- `scripts/backend-notify.js` — envía resultados de validación al backend
- `scripts/pre-publish-gate.js` — bloquea el build si hay errores, notifica al backend
- `scripts/post-publish-callback.js` — notifica al backend tras deploy exitoso
- `.github/workflows/deploy.yml` — paso `📣 Post-Publish Callback` después del deploy
- `.github/workflows/content-guard.yml` — paso `📣 Notify Backend on Validation Failure`

## Lo que falta en el backend

El backend (`noticiencias_news_collector`) necesita un endpoint HTTP que reciba:

### Payload de validación (POST)
```json
{
  "event": "validation_result",
  "commit_sha": "abc123",
  "branch": "main",
  "status": "fail",
  "diagnostics": [
    {
      "check": "editorial-fields",
      "status": "fail",
      "filesCount": 42,
      "errors": [
        { "file": "2026-06-01-ejemplo.md", "message": "falta glossary" }
      ]
    }
  ],
  "frontend_ref": "abc123",
  "run_url": "https://github.com/cortega26/noticiencias/actions/runs/123",
  "timestamp": "2026-06-24T12:00:00Z"
}
```

### Payload de deploy exitoso (POST)
```json
{
  "event": "publish_complete",
  "commit_sha": "abc123",
  "branch": "main",
  "status": "success",
  "diagnostics": [
    {
      "check": "deploy",
      "status": "pass",
      "article_count": 42,
      "deploy_url": "https://noticiencias.com"
    }
  ],
  "frontend_ref": "abc123",
  "run_url": "https://github.com/cortega26/noticiencias/actions/runs/456",
  "timestamp": "2026-06-24T12:05:00Z"
}
```

## Configuración final

Cuando el endpoint esté listo, añade el secreto en GitHub:

```bash
gh secret set BACKEND_WEBHOOK_URL --body "https://tu-backend.com/webhooks/noticiencias" --repo cortega26/noticiencias
```
