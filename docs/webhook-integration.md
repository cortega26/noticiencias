# Integración del webhook de publicación

Estado: Activo. Contrato comprobado contra el código el 2026-09-04.

El backend ya implementa `POST /api/v1/webhook/frontend` en
`../noticiencias_news_collector/news_collector/serving/api.py`. El contrato
está en `../noticiencias_news_collector/news_collector/contracts/webhook.py`
y sus transiciones en
`../noticiencias_news_collector/news_collector/serving/webhook_handler.py`.
Este endpoint es independiente del formulario público `POST /api/report`.

## Transporte y configuración

`scripts/backend-notify.js` construye el sobre y realiza el envío. En el
frontend, `BACKEND_WEBHOOK_URL` contiene la URL completa del endpoint y
`BACKEND_WEBHOOK_TOKEN` se envía como Bearer. El backend valida ese token
contra `WEBHOOK_API_KEY`. La notificación es de mejor esfuerzo: la ausencia
de configuración o un fallo HTTP no bloquean por sí solos el despliegue.

- `.github/workflows/content-guard.yml` envía `validation_result` cuando
  falla la validación y dispone de los secretos necesarios.
- `scripts/pre-publish-gate.js` puede notificar fallos si recibe esas
  variables. El paso que lo ejecuta en `.github/workflows/deploy.yml` no
  les asigna los secretos; no debe asumirse que ese paso cierra el circuito.
- `.github/workflows/deploy.yml` ejecuta `scripts/post-publish-callback.js`
  después del despliegue y sus comprobaciones, con `publish_complete`.

## Identidad y estados

El sobre incluye `event`, `status`, `diagnostics`, `commit_sha`, `branch`,
`frontend_ref`, `run_url`, `timestamp` y `publication_ids`. Las formas exactas
pertenecen al constructor y al contrato Python enlazados arriba.

`publication_ids` identifica intentos mediante los valores `refinery_id`
de los artículos afectados. El callback de despliegue los extrae del rango
Git de `GITHUB_BASE_SHA` a `GITHUB_SHA`. Sin SHA base o sin IDs recuperables,
el evento puede llegar con una lista vacía: el backend no infiere artículos
por nombre de rama y no modifica intentos en ese caso.

Un `validation_result` con estado `fail` rechaza los intentos identificados;
un `publish_complete` completa los intentos identificados y usa la URL de
despliegue de los diagnósticos cuando está disponible. Crear un PR, terminar
un workflow del backend y confirmar un despliegue son sucesos distintos.
La ausencia de callback no demuestra que el despliegue haya fallado.

## Diagnóstico

Revisar el rango Git, los IDs enviados, el resultado HTTP y los registros
del backend antes de atribuir un estado desactualizado a un fallo editorial.
No registrar tokens. Para una prueba del circuito completo, usar un intento
de prueba identificable y verificar su transición; no reenviar IDs de
publicaciones reales como prueba de conectividad.
