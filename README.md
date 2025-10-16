# Jira Telegram Notifier

## Installation

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file from the example:
    ```bash
    cp .env.example .env
    ```
    Then, fill in the necessary credentials in the `.env` file.

## Running with PM2

1.  **Install `pm2` globally (if not already installed):**
    ```bash
    npm install pm2 -g
    ```

2.  **Start the application:**
    ```bash
    pm2 start ecosystem.config.js
    ```

3.  **To view logs:**
    ```bash
    pm2 logs jira-telegram-notifier
    ```

4.  **To stop the application:**
    ```bash
    pm2 stop jira-telegram-notifier
    ```

5.  **To set up automatic startup after server reboot:**
    ```bash
    pm2 startup
    ```
    `pm2` will provide a command that you will need to execute.
