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
});
