# Medición: checklist del operador (plan 009, fase 2)

Todo el código de medición ya está en `main` y **apagado**. Encenderlo requiere tres valores que solo salen de tus cuentas, más cuatro decisiones o ajustes. Este documento es el orden exacto. Contexto y decisiones: `docs/adr/0012-ga4-consent-mode.md` y `plans/009-analytics-ga4-consent.md`.

## Orden recomendado

| #   | Tarea                       | Dónde                            | Resultado                          |
| --- | --------------------------- | -------------------------------- | ---------------------------------- |
| 1   | Crear la propiedad GA4      | analytics.google.com             | Measurement ID `G-XXXXXXXXXX`      |
| 2   | Ajustar retención y eventos | GA4 → Administrar                | Retención 14 meses, evento clave   |
| 3   | Verificar Search Console    | search.google.com/search-console | Valor de verificación              |
| 4   | Obtener el token del beacon | Workflow o panel de Cloudflare   | Token de Web Analytics             |
| 5   | Regla de headers en el edge | Cloudflare → Rules               | CSP como header real (opcional)    |
| 6   | Confirmar la postura legal  | Tú                               | Visto bueno para publicar el texto |
| 7   | Encender                    | PR de la fase 2                  | Medición activa                    |

Los pasos 1 a 4 son independientes y se pueden hacer en cualquier orden.

## 1. Propiedad GA4

1. En Google Analytics: **Administrar → Crear → Propiedad**. Zona horaria y moneda de Chile.
2. Crea un **flujo de datos web** para `https://noticiencias.com`.
3. **Desactiva "Medición mejorada" → "Clics de salida" y "Búsqueda en el sitio"** si quieres evitar duplicados con nuestros eventos `outbound_source_click` y `search`. Deja el resto.
4. Copia el **ID de medición** (`G-…`).
5. **Deja Google Signals desactivado** (Administrar → Configuración de datos → Recopilación de datos). El CSP y el texto de privacidad asumen que está apagado.

## 2. Retención y eventos (en GA4)

- **Retención**: Administrar → Configuración de datos → Retención de datos → **14 meses**. El valor por defecto son 2 meses y **el cambio no es retroactivo**, así que hazlo antes de que se acumule tráfico. El texto de privacidad ya declara 14 meses.
- **Evento clave**: cuando llegue el primer `newsletter_signup` (puede tardar horas en aparecer), márcalo en Administrar → Eventos como evento clave. Recuerda que cuenta envíos del formulario, no suscripciones confirmadas: Buttondown usa doble confirmación.
- **Dimensiones personalizadas** (ámbito _Evento_), para verlas en informes: `link_domain`, `search_term`, `results_count`.

## 3. Search Console

1. Agrega una propiedad de **prefijo de URL** `https://noticiencias.com/` y elige verificar con la **etiqueta HTML**.
2. Copia solo el valor de `content="…"` de la etiqueta `<meta name="google-site-verification">`.
3. Ese valor va en `googleSiteVerificationId` de `src/config.yaml`. El componente `SiteVerification.astro` ya emite la etiqueta.
4. Tras el deploy, pulsa **Verificar**. Después enlaza la propiedad con GA4 (GA4 → Administrar → Enlaces de productos → Search Console).

Es la fuente de impresiones y clics de Google Search y de Discover; conviene hacerla primero porque tarda días en acumular datos.

## 4. Token de Cloudflare Web Analytics

**Opción A — automática.** El workflow "Cloudflare Web Analytics — provision (manual)" prueba si `CLOUDFLARE_API_TOKEN` tiene permiso de Web Analytics. Ejecútalo primero **sin** `create` (solo lista) y, si funciona, con `create` activado. El token del beacon aparece en el resumen del job. No es un secreto: va en el HTML de cada página.

```bash
gh workflow run cloudflare-web-analytics-provision.yml -f create=false
gh run watch
gh workflow run cloudflare-web-analytics-provision.yml -f create=true
```

Si falla con "Authentication error", el token no tiene el permiso. Crea uno con **Account → Web Analytics → Edit**, actualiza el secreto `CLOUDFLARE_API_TOKEN` (o crea otro) y repite.

**Opción B — manual.** Panel de Cloudflare → **Analytics & Logs → Web Analytics → Add a site** → host `noticiencias.com` → método **manual** (no "automatic setup") → copia el `token` del snippet.

Va en `analytics.vendors.cloudflare.token` de `src/config.yaml`.

## 5. Header CSP en el edge (opcional)

El CSP ya se aplica desde la etiqueta `<meta>` de `CommonMeta.astro`, que es lo que realmente bloquea en GitHub Pages. El header en el edge solo lo refuerza y mejora la nota de securityheaders.com. **Afecta a todo el tráfico**: un CSP equivocado rompe el sitio, así que pruébalo primero en una regla acotada a una ruta.

La política a usar está en `docs/DEPLOYMENT_SECURITY_HEADERS.md` (línea `Content-Security-Policy`); un test la mantiene idéntica a la del `<meta>`. Cloudflare → Rules → Transform Rules → **Modify Response Header**, para los hosts `noticiencias.com` y `www.noticiencias.com`. Verificación posterior: `npm run test:deploy -- https://noticiencias.com/`.

## 6. Postura legal

La política de privacidad ya describe GA4 con Consent Mode avanzado, incluido que **el código de Google carga antes de que elijas**. Confirma tú (o con quien corresponda) que esa postura es aceptable bajo la Ley 19.628 antes de publicar. El texto redactado no es asesoría legal.

## 7. Encender

En el PR de la fase 2, un único cambio de configuración:

```yaml
# src/config.yaml
googleSiteVerificationId: '<valor del paso 3>'
analytics:
  vendors:
    googleAnalytics:
      id: 'G-XXXXXXXXXX' # paso 1
    cloudflare:
      token: '<token del paso 4>'
```

Antes de mergear, comprueba que el texto de `src/pages/privacidad.md` y `src/pages/transparencia.md` sigue siendo cierto (retención de 14 meses, Google Signals apagado) y actualiza la fecha de "Última actualización".

### Verificación posterior al deploy

1. `curl -s https://noticiencias.com/ | grep -c google-site-verification` → `1`.
2. En una ventana privada, abre el sitio: debe aparecer el aviso y **no debe existir** ninguna cookie `_ga` (DevTools → Application → Cookies).
3. Pulsa **Aceptar**: aparecen `_ga` y `_ga_<ID>`. Pulsa "Preferencias de privacidad" en el pie y **Rechazar**: no se envían más actualizaciones de consentimiento a `granted`.
4. GA4 → **Informes → Tiempo real**: tu visita aparece. Los tests automáticos usan un `gtag.js` simulado y no pueden comprobar esto.
5. En **Explorar** o **DebugView**, dispara un envío del boletín, un clic a una fuente, un scroll y una búsqueda, y confirma `newsletter_signup`, `outbound_source_click`, `scroll_75` y `search`.
6. Cloudflare → Web Analytics: aparece tráfico en las siguientes horas.
