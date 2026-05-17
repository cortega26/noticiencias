#!/usr/bin/env python3
"""Run browser smoke checks against the built Astro preview.

The script starts `astro preview`, checks representative routes at mobile and desktop widths,
and fails on console errors, broken images, missing canonicals, horizontal overflow, or blank
screenshots. Set NOTICIENCIAS_VISUAL_DIR to persist screenshots for visual review.
"""

from __future__ import annotations

import io
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("NOTICIENCIAS_VISUAL_HOST", "127.0.0.1")
PORT = int(os.environ.get("NOTICIENCIAS_VISUAL_PORT", "4323"))
BASE_URL = f"http://{HOST}:{PORT}"
ROUTES = [
    "/",
    "/buscar/",
    "/newsletter/",
    "/categorias/ciencia/",
    "/temas/materia-oscura/",
    "/ciencia/2026-01-18-article-64/",
    "/privacidad/",
    "/terminos/",
]
VIEWPORTS = [
    {"name": "mobile", "width": 375, "height": 812},
    {"name": "desktop", "width": 1280, "height": 900},
]


def fail(message: str) -> None:
    print(f"visual-smoke: {message}", file=sys.stderr)
    sys.exit(1)


def wait_for_preview() -> None:
    deadline = time.monotonic() + 30
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(BASE_URL, timeout=2) as response:
                if response.status < 500:
                    return
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
        time.sleep(0.5)

    fail(f"preview server did not become ready at {BASE_URL}: {last_error}")


def screenshot_has_variance(png_bytes: bytes) -> bool:
    image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    extrema = image.getextrema()
    return any(low != high for low, high in extrema)


def run_checks() -> list[str]:
    failures: list[str] = []
    screenshot_dir_value = os.environ.get("NOTICIENCIAS_VISUAL_DIR")
    screenshot_dir = Path(screenshot_dir_value) if screenshot_dir_value else None

    if screenshot_dir:
        screenshot_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for viewport in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": viewport["width"], "height": viewport["height"]}
            )

            for route in ROUTES:
                page = context.new_page()
                console_errors: list[str] = []
                page_errors: list[str] = []

                page.on(
                    "console",
                    lambda message: (
                        console_errors.append(message.text) if message.type == "error" else None
                    ),
                )
                page.on("pageerror", lambda error: page_errors.append(str(error)))

                label = f"{viewport['name']} {route}"
                try:
                    response = page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                    if response is None or response.status >= 400:
                        failures.append(f"{label}: HTTP status {response.status if response else 'none'}")
                        continue

                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightError:
                        pass

                    page.evaluate(
                        """
                        async () => {
                          const step = Math.max(window.innerHeight, 600);
                          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
                            window.scrollTo(0, y);
                            await new Promise((resolve) => setTimeout(resolve, 80));
                          }
                          window.scrollTo(0, 0);
                        }
                        """
                    )

                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightError:
                        pass

                    title = page.title().strip()
                    if not title:
                        failures.append(f"{label}: missing document title")

                    body_text_length = page.evaluate(
                        "document.body ? document.body.innerText.trim().length : 0"
                    )
                    if body_text_length < 50:
                        failures.append(f"{label}: body content appears too thin")

                    canonical = page.locator('link[rel="canonical"]').first.get_attribute("href")
                    if not canonical or not canonical.startswith("https://noticiencias.com"):
                        failures.append(f"{label}: missing production canonical")

                    broken_images = page.evaluate(
                        """
                        async () => {
                          const checks = await Promise.all(
                            Array.from(document.images).map(async (image) => {
                              const src = image.currentSrc || image.src;
                              if (!src) return image.alt || '<unknown>';
                              if (image.complete && image.naturalWidth > 0) return null;

                              try {
                                const response = await fetch(src, { cache: 'force-cache' });
                                return response.ok ? null : src;
                              } catch {
                                return src;
                              }
                            })
                          );

                          return checks.filter(Boolean);
                        }
                        """
                    )
                    if broken_images:
                        failures.append(f"{label}: broken images: {', '.join(broken_images)}")

                    has_horizontal_overflow = page.evaluate(
                        "document.documentElement.scrollWidth > window.innerWidth + 2"
                    )
                    if has_horizontal_overflow:
                        failures.append(f"{label}: horizontal overflow")

                    png_bytes = page.screenshot(full_page=False)
                    if len(png_bytes) < 5_000 or not screenshot_has_variance(png_bytes):
                        failures.append(f"{label}: screenshot appears blank")

                    if screenshot_dir:
                        safe_route = route.strip("/").replace("/", "__") or "home"
                        screenshot_path = screenshot_dir / f"{viewport['name']}__{safe_route}.png"
                        screenshot_path.write_bytes(png_bytes)

                    if console_errors:
                        failures.append(f"{label}: console errors: {' | '.join(console_errors)}")
                    if page_errors:
                        failures.append(f"{label}: page errors: {' | '.join(page_errors)}")
                finally:
                    page.close()

            context.close()

        browser.close()

    return failures


def main() -> None:
    if not (REPO_ROOT / "dist").exists():
        fail("dist/ is missing. Run npm run build first.")

    preview = subprocess.Popen(
        ["npm", "run", "preview", "--", "--host", HOST, "--port", str(PORT)],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_preview()
        failures = run_checks()
    finally:
        preview.terminate()
        try:
            preview.wait(timeout=10)
        except subprocess.TimeoutExpired:
            preview.kill()
            preview.wait(timeout=10)

    if failures:
        print("\n".join(failures), file=sys.stderr)
        sys.exit(1)

    print(f"visual-smoke: passed {len(ROUTES) * len(VIEWPORTS)} route/viewport checks")


if __name__ == "__main__":
    main()
