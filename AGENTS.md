# Guía de agentes de Noticiencias

## Taxonomía de agentes
| Agente | Rol principal | Entrega |
|--------|---------------|---------|
| Monitor de fuentes | Revisa journals, instituciones y agregadores | Pasa artículos candidatos al Traductor |
| Traductor | Genera borradores en español con IA | Envía al Revisor científico |
| Revisor científico | Comprueba datos y metodología | Devuelve observaciones al Editor |
| Editor de estilo | Ajusta lenguaje B1-B2 y SEO | Publica o devuelve para correcciones |
| Asistente de redes | Prepara mensajes para plataformas sociales | Coordina con Editor |

## Habilidades y herramientas
- DeepL y ChatGPT para borradores de traducción.
- Google Analytics 4 para métricas.
- Mailchimp para newsletter.
- Cloudflare para CDN.
- TODO: herramientas adicionales.

## Prompts y políticas
- Nunca usar IA para datos o afirmaciones técnicas.
- Mantener tono anti-sensacionalista.
- Citar siempre la fuente original con DOI.
- Añadir limitaciones y advertencias cuando corresponda.
- TODO: plantilla de prompts detallados.

## Esquemas de entrada/salida
- **Entrada artículo:** título, enlace, fecha, resumen de origen.
- **Salida artículo:** Markdown con frontmatter, secciones y fuentes.
- **Entrada redes:** título, enlace, resumen corto.
- **Salida redes:** texto optimizado y hashtags.

## Lógica de decisión y handoffs
1. Monitor detecta fuente válida.
2. Traductor crea borrador y marca dudas.
3. Revisor valida cifras y metodología.
4. Editor pule estilo, SEO y publica.
5. Asistente de redes difunde contenido.
6. Si se detecta error, se devuelve al paso pertinente.

## Variables de entorno y claves API
| Variable | Uso | Nota |
|---------|-----|------|
| `GA4_ID` | Seguimiento de analíticas | TODO |
| `MAILCHIMP_API_KEY` | Envío de newsletter | TODO |
| `DEEPL_API_KEY` | Traducción asistida | TODO |
| `CLOUDFLARE_TOKEN` | Caché y despliegue | TODO |

## Despliegue
1. Ejecuta `bundle exec jekyll build`.
2. Verifica salida en `_site`.
3. Haz commit y push a la rama principal.
4. GitHub Pages publica y Cloudflare distribuye.

## Evaluación
- Visitas únicas, suscriptores y duración media de sesión.
- Ratio de retorno y ingresos por visitante.
- Lista de verificación editorial previa a publicación.
- TODO: métricas de redes sociales.

## Seguridad y límites
- Correcciones transparentes ante errores.
- Retirar contenido ante reclamos de copyright.
- Nunca publicar contenido generado por IA sin revisión humana.
- TODO: políticas de privacidad detalladas.

## Solución de problemas
- **Build falla:** ejecutar `bundle install` y repetir.
- **Datos analíticos ausentes:** revisar `GA4_ID`.
- **Contenido cuestionado:** seguir protocolo de corrección.
- TODO: guía ampliada de troubleshooting.
