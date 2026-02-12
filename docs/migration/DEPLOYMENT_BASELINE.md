# Deployment Baseline

## Host
- **Platform**: GitHub Pages
- **Environment**: `github-pages`

## Configuration
- **Site URL**: `https://noticiencias.com` (from `astro.config.mjs`)
- **Base URL**: `/` (implicit, no base set in config)

## CI/CD Workflow
- **File**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` or manual dispatch.
- **Action**: `withastro/action@v3`
- **Steps**:
    1. Checkout
    2. Install & Build (`withastro/action`)
    3. Run Integrity Tests (`npm run test:audit`)
    4. Deploy (`actions/deploy-pages@v4`)

## Integrity Checks
- `npm run test:audit` is a hard gate. Migration must ensure this script (or updated version) passes.
