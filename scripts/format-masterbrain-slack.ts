/**
 * Format MasterBrain output as Slack message
 *
 * Fetches MasterBrain analysis and formats it as a Slack message
 */

import { MasterBrainFormatter } from '../src/lib/master-brain-formatter';

const PILOT_CLIENT_ID = 'zPIorY5SDvoUQ1zTEFqi';
const PILOT_CLIENT_NAME = 'Alma Colchones';

async function fetchAndFormat() {
  console.log('Fetching MasterBrain analysis...\n');

  try {
    const response = await fetch(
      `http://localhost:3000/api/test/masterbrain?clientId=${PILOT_CLIENT_ID}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Analysis failed: ${data.error}`);
    }

    // Format as Slack message
    const slackMessage = MasterBrainFormatter.formatSlackMessage(
      PILOT_CLIENT_NAME,
      data.analysis
    );

    console.log(slackMessage);
    console.log('\n');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fetchAndFormat()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
