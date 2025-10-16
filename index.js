
require('dotenv').config();
const { Version3Client } = require('jira.js');
const { Telegraf } = require('telegraf');

// --- Configuration ---
const {
  JIRA_HOST,
  JIRA_USER,
  JIRA_API_TOKEN,
  JIRA_BOARD_NAME,
  JIRA_STATUS_NAME,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  CHECK_INTERVAL_MS
} = process.env;

if (!JIRA_HOST || !JIRA_USER || !JIRA_API_TOKEN || !JIRA_BOARD_NAME || !JIRA_STATUS_NAME || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// --- Initialize Clients ---
const jira = new Version3Client({
  host: JIRA_HOST,
  authentication: {
    basic: {
      email: JIRA_USER,
      apiToken: JIRA_API_TOKEN,
    },
  },
});

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// --- State ---
const seenTaskIds = new Set();
let isFirstRun = true;

// --- Functions ---

/**
 * Fetches tasks from the specified Jira board and status.
 */
async function fetchTasks() {
  try {
    const jql = `project = "${JIRA_BOARD_NAME}" AND status = "${JIRA_STATUS_NAME}" ORDER BY created DESC`;
    const result = await jira.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql,
      fields: ['*all', '-comment'],
    });
    return result.issues || [];
  } catch (error) {
    console.error('Error fetching tasks from Jira:', error.message || error);
    return [];
  }
}

/**
 * Sends a notification to Telegram about a new task.
 * @param {object} task The Jira task object.
 */
function sendTelegramNotification(task) {
  // const taskUrl = `https://${JIRA_HOST}/browse/${task.key}`;
  const taskUrl = `https://${JIRA_HOST}/jira/software/c/projects/TB/boards/66?modal=detail&selectedIssue=${task.key}`;

  let mess = `\n*${task.summary}*`;
  mess += `\nОт ${task.creator ? task.creator.displayName : "invisible human"}`;

  if (Array.isArray(task.labels) && task.labels.length) {
    mess += `\nТэги: ${task.labels.join(", ")}`;
  }

  if (task.priority) {
    mess += `\nПриоритет ${task.priority.name}`;
  }

  msg += "\n" + taskUrl;

  bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' })
    // .then(() => console.log(`Notification sent for task ${task.key}`))
    .catch(err => console.error('Error sending Telegram message:', err));
}

/**
 * Main function to check for new tasks and send notifications.
 */
async function checkAndNotify() {
  // console.log('Checking for new tasks...');
  const tasks = await fetchTasks();

  if (isFirstRun) {
    // On the first run, we populate the 'seen' list without notifying
    tasks.forEach(task => seenTaskIds.add(task.id));
    // console.log(`Initial run: Found ${tasks.length} tasks. They will not be notified.`);
    isFirstRun = false;
    return;
  }

  for (const task of tasks) {
    if (!seenTaskIds.has(task.id)) {
      // console.log(`New task found: ${task.key} - ${task.fields.summary}`);
      sendTelegramNotification(task);
      seenTaskIds.add(task.id);
    }
  }
}

// --- Main Execution ---
console.log('Starting Jira Task Notifier...');
console.log(`Watching board "${JIRA_BOARD_NAME}" for tasks in status "${JIRA_STATUS_NAME}"`);

// Check immediately on start, then set an interval
checkAndNotify();
setInterval(checkAndNotify, parseInt(CHECK_INTERVAL_MS, 10) || 60000);

// Optional: A simple command to check bot status
bot.start((ctx) => ctx.reply('Jira Notifier Bot is running.'));
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
