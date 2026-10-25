# Regresión del aviso de portada — 25 de octubre de 2026

## Causa comprobada

- `1508ddfb2ee45e80d95293fce7772c9265eb4402` (19-oct) eliminó del cuerpo de Shanidar el aviso redundante y añadió la política pública de IA, que sitúa la etiqueta bajo la imagen.
- `22c7af9bc7f87951205abf08a2a70045350f7885` (22-oct) volvió a insertar un párrafo «Imagen de portada:» al reescribir el artículo. Fue una edición del Markdown del frontend, no una inserción del publicador backend ni una duplicación causada por el layout.
- `b12a8fd7440b634bfb51342308ae71896aa5f9a6` (24/25-oct, PR #351) reformuló ese párrafo durante el cambio de imagen en vez de respetar su eliminación previa.

El backend ya aplica la declaración de imagen generada en `image_alt`; `test_ai_generated_alt_gets_the_visible_caption_prefix` comprueba que no se repita en el cuerpo. Esa prueba no cubre las ediciones directas del Markdown del frontend. Los controles del frontend no rechazaban esos párrafos y sus pruebas podían pasar con la regresión presente. Se omitió comprobar la decisión previa al revisar el cambio editorial y después el de imagen.

## Corrección y prevención

- Se retiran los once párrafos «Imagen de portada:» encontrados en los 52 artículos actuales, incluido Shanidar. No se reescriben sus frontmatter, textos alternativos, imágenes ni afirmaciones factuales. La declaración visible permanece una sola vez en el pie que `PostLayout` genera desde `image_alt`.
- `AGENTS.md`, LAW-F7, fija expresamente esa ubicación y prohíbe repetir la declaración en el cuerpo durante reescrituras o renovaciones de imagen.
- El control existente `check:content-quality` rechaza el patrón `hero-caption-in-body`, con o sin cursiva/negrita, diferencias de mayúsculas y salto de línea entre palabras. Ese control se ejecuta en lint, validación de contenido, el hook de commit de artículos, Content Guard y la puerta previa al despliegue de Pages. No se oculta ni se elimina contenido durante el renderizado.
- Las pruebas de regresión reproducen la frase de Shanidar y tres variantes de formato. Las cuatro fallaron antes del cambio y pasan con el bloqueo. Una prueba positiva conserva la declaración en `image_alt` y permite artículos que hablan de IA.
- Antes de retirar los párrafos, el comando real rechazó los once artículos afectados. Tras retirarlos, los 52 pasan el mismo control.
- Una reinserción deliberada del aviso de Shanidar hizo fallar el comando real `pre-publish-gate.js`, con las notificaciones externas desactivadas. Se restauró el archivo byte por byte y la puerta volvió a pasar. Esto verifica que el bloqueo también actúa antes de desplegar.

Los recibos de generación y snapshots históricos conservan sus textos originales como evidencia del estado anterior; no son plantillas para volver a insertar créditos en los artículos. La comprobación del despliegue se registra por separado en la PR de esta corrección.
