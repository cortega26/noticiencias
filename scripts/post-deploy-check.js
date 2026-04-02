
import {
  DEFAULT_DEPLOY_CHECK_MODE,
  DEFAULT_TARGET_URL,
  formatFinalSummary,
  runPostDeployCheck,
} from './post-deploy-check-lib.js';

const TARGET_URL = process.argv[2] || process.env.DEPLOY_URL || DEFAULT_TARGET_URL;
const MODE = process.env.DEPLOY_CHECK_MODE || DEFAULT_DEPLOY_CHECK_MODE;
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function main() {
  try {
    const result = await runPostDeployCheck(TARGET_URL, { mode: MODE });
    console.log(formatFinalSummary(result.warnings));
  } catch (error) {
    console.error(`${RED}[FAIL] ${error.message}${RESET}`);
    process.exit(1);
  }
}

main();
