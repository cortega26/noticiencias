import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const WORKFLOW_DIRECTORY = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const DEPLOY_PATH = fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url));
const oldUploadArtifactPin = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';
const node24UploadArtifactPin =
  'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2';

describe('workflow deploy annotations', () => {
  it('uses SHA-pinned Node 24 artifact uploads in all workflows', () => {
    const workflows = readdirSync(WORKFLOW_DIRECTORY)
      .filter((filename) => /\.ya?ml$/.test(filename))
      .map((filename) => readFileSync(`${WORKFLOW_DIRECTORY}/${filename}`, 'utf8'));
    const uploaders = workflows.filter((workflow) => workflow.includes('actions/upload-artifact@'));
    expect(uploaders.length).toBeGreaterThan(0);

    for (const workflow of uploaders) {
      expect(workflow).not.toContain(oldUploadArtifactPin);
      const pins = workflow.match(/^\s*uses: actions\/upload-artifact@.+$/gm) ?? [];
      expect(pins.length).toBeGreaterThan(0);
      for (const pin of pins) {
        expect(pin).toContain(node24UploadArtifactPin);
      }
    }
  });

  it('keeps the protected Pages environment without a masked URL annotation', () => {
    const deploy = readFileSync(DEPLOY_PATH, 'utf8');
    expect(deploy).toMatch(/environment:\s*\n\s*name: github-pages/);
    expect(deploy).not.toMatch(/^\s*url: https:\/\/noticiencias\.com\s*$/m);
    expect(deploy).toContain('GITHUB_STEP_SUMMARY');
    expect(deploy).toContain('https://noticiencias.com');
    expect(deploy).not.toContain('::notice::Image delivery mode');
    expect(deploy).toContain('Image delivery mode is github');
  });
});
