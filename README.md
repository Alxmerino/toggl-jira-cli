# Toggl to JIRA CLI

CLI tool to log my time from Toggl to JIRA

## Prerequisite
This is tested and working on NodeJS 20.x

## Usage
Run `node --env-file=.env ./src/index.js` to log today's time. It also accept a date argument such as `today`, `yesterday` or in `YYYY-MM-DD` formtat.

## Environment Variables

### Required
- `TOGGL_TOKEN` – Toggl API token for authentication

### Optional
- `TOGGL_USE_JIRA` – Set to `yes` to enable JIRA syncing. If not set or any other value, JIRA prompt will be skipped.
- `JIRA_USER` – JIRA username for Basic Auth (required if `TOGGL_USE_JIRA=yes`)
- `JIRA_PASSWORD` – JIRA password for Basic Auth (required if `TOGGL_USE_JIRA=yes`)
- `JIRA_API_URL` – JIRA API base URL (required if `TOGGL_USE_JIRA=yes`)

## Aliasing
In your `.zshrc` add an alias such as `log-time` so this command runs from anywhere 

```bash
alias log-time='node --env-file=/path/to/.env ~/path/to/src/index.js'
```
