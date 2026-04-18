import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { collectContentQualityDiagnostics } from '../scripts/utils/content-quality.js';

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-content-quality-'));
  tempDirs.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, 'src', 'content', 'posts'), { recursive: true });
  return repoRoot;
}

function writePost(repoRoot: string, filename: string, body: string): void {
  fs.writeFileSync(
    path.join(repoRoot, 'src', 'content', 'posts', filename),
    `---
title: Test
schema_version: 2
excerpt: A sufficiently long excerpt for testing content quality.
author: Noticiencias
date: 2026-04-02
categories:
  - Ciencia
tags:
  - prueba
image: "~/assets/images/default.png"
image_alt: "alt text"
---

${body}
`,
    'utf8'
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('content quality diagnostics', () => {
  it('rejects placeholder-style stub articles', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-bad.md',
      `## Fuga del Código Fuente Completo de Claude Code CLI

El contenido fuente proporcionado para este artículo es ilegible y corrupto, impidiendo la elaboración de un texto que cumpla con los estándares de rigor científico.

Fuente original: [https://example.com/source](https://example.com/source)
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('blocked content-quality pattern detected'),
        expect.stringContaining('article body is too thin'),
      ])
    );
  });

  it('accepts real published article bodies with source footer', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-good.md',
      `## Un error de empaquetado expone el interior de Claude Code

Anthropic publicó una versión del paquete de Claude Code para npm que incluía un archivo source map. Ese archivo permitió reconstruir casi todo el código TypeScript de la herramienta, algo especialmente sensible porque Claude Code se ha vuelto una de las interfaces más visibles para programar con modelos de IA en la terminal.

La filtración no expuso datos de clientes ni credenciales, según la propia empresa, pero sí abrió una ventana inusual a la arquitectura interna del producto. Investigadores y desarrolladores empezaron a revisar de inmediato módulos relacionados con memoria, verificación de contexto y herramientas conectadas al flujo de trabajo del agente.

El episodio muestra un riesgo operativo clásico en software moderno: un error de empaquetado puede convertir metadatos útiles para depurar en una fuga masiva de propiedad intelectual. También deja a potenciales atacantes con más pistas para estudiar la superficie de seguridad del producto y buscar puntos débiles en sus guardrails.

Fuente original: [https://example.com/source](https://example.com/source)
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual([]);
  });

  it('accepts body headings that start at H2 and descend one level at a time', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-valid-headings.md',
      `## Apertura

Un hallazgo reciente abre una nueva línea de investigación sobre el comportamiento de materiales complejos y explica por qué el fenómeno sorprendió incluso a especialistas del área. La observación inicial ayuda a ubicar el problema antes de entrar en los detalles técnicos del estudio.

### Qué hicieron los investigadores

El equipo reunió evidencia experimental durante varios meses y comparó sus resultados con trabajos previos para distinguir con claridad entre observaciones sólidas, hipótesis intermedias y conclusiones más tentativas.

## Contexto científico

El resultado se conecta con preguntas de largo plazo en el campo y ofrece una explicación más robusta de un patrón que antes parecía contradictorio con la teoría dominante.
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual([]);
  });

  it('rejects a first body heading that starts at H3', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-bad-first-h3.md',
      `### Apertura

Este artículo contiene suficiente texto para pasar el mínimo narrativo, pero su primera cabecera del cuerpo empieza demasiado abajo y crea un salto de jerarquía que dificulta la navegación del documento para tecnologías de asistencia y lectores humanos.

Este segundo párrafo mantiene el cuerpo con longitud suficiente para que la validación de headings sea el motivo principal del fallo en lugar de una detección por texto demasiado breve.
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('skips from H1 to H3')])
    );
  });

  it('rejects body headings that use H1', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-bad-h1.md',
      `# Apertura duplicada

El cuerpo repite un H1 aunque la página ya renderiza el título principal en el encabezado compartido. Eso rompe la jerarquía esperada del artículo y complica la experiencia de lectura estructurada.

El resto del contenido existe solo para asegurar que el diagnóstico relevante sea el de heading inválido y no un problema secundario de longitud mínima.
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('must not use H1')])
    );
  });

  it('rejects later heading jumps larger than one level', () => {
    const repoRoot = makeRepo();
    writePost(
      repoRoot,
      '2026-04-02-bad-jump.md',
      `## Apertura

El artículo comienza correctamente con una sección de segundo nivel y desarrolla el contexto necesario para entender el estudio antes de entrar en una subsección más específica del análisis principal.

#### Hallazgo demasiado profundo

Ese subtítulo baja dos niveles de golpe sin pasar por un H3 intermedio, lo que genera una estructura confusa para asistentes de navegación y para el índice de contenidos derivado del documento.
`
    );

    const diagnostics = collectContentQualityDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('skips from H2 to H4')])
    );
  });
});
