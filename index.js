import 'dotenv/config';
import { Version3Client } from 'jira.js';
import { Telegraf } from 'telegraf';

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
  const taskUrl = `https://${JIRA_HOST}/jira/software/c/projects/TB/boards/66?modal=detail&selectedIssue=${task.key}`;

  let mess = `
*${task.fields.summary}*`;
  mess += `
От ${task.fields.creator ? task.fields.creator.displayName : "invisible human"}`;

  if (Array.isArray(task.fields.labels) && task.fields.labels.length) {
    mess += `
Тэги: ${task.fields.labels.join(", ")}`;
  }

  if (task.fields.priority) {
    mess += `
Приоритет ${task.fields.priority.name}`;
  }

  mess += "\n" + taskUrl;

  bot.telegram.sendMessage(TELEGRAM_CHAT_ID, mess, { parse_mode: 'Markdown' })
    .catch(err => console.error('Error sending Telegram message:', err));
}

/**
 * Main function to check for new tasks and send notifications.
 */
async function checkAndNotify() {
  const tasks = await fetchTasks();

  if (isFirstRun) {
    tasks.forEach(task => seenTaskIds.add(task.id));
    isFirstRun = false;
    return;
  }

  for (const task of tasks) {
    if (!seenTaskIds.has(task.id)) {
      sendTelegramNotification(task);
      seenTaskIds.add(task.id);
    }
  }
}

// --- Main Execution ---
console.log('Starting Jira Task Notifier...');
console.log(`Watching board "${JIRA_BOARD_NAME}" for tasks in status "${JIRA_STATUS_NAME}"`);

checkAndNotify();
setInterval(checkAndNotify, parseInt(CHECK_INTERVAL_MS, 10) || 60000);

bot.start((ctx) => ctx.reply('Jira Notifier Bot is running.'));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));