# Toggl to JIRA CLI

CLI tool to log my time from Toggl to JIRA

## Prerequisite
This is tested and working on NodeJS 20.x

## Usage
Run `node --env-file=.env ./src/index.js` to show today's time. It also accepts a date argument such as `today`, `yesterday`, `YYYY-MM-DD` or `MM-DD`.

Add `log` (e.g. `./src/index.js log` or `./src/index.js log yesterday`) to open a local page after the summary where you adjust hours and add a comment per issue, then log each one to Everhour. Requires `EVERHOUR_TOKEN`.

## Environment Variables

### Required
- `TOGGL_TOKEN` – Toggl API token for authentication

### Optional
- `EVERHOUR_TOKEN`: Everhour API key (bottom of https://app.everhour.com/#/account/profile). Used by the `log` command. If it is not set, `log` opens your Everhour profile and asks you to paste the key for that run. Issues match Everhour tasks by Jira key. Re-running for the same date updates the existing Everhour record, so time is not doubled. Issues with no matching Everhour task get a search box; the task you pick is saved in `.everhour-mappings.json` and used for that tag from then on. Found tasks are cached in `.everhour-tasks.json` (safe to delete). The Jira prompt is skipped when `log` is used.
- `TOGGL_USE_JIRA` – Set to `yes` to enable JIRA syncing. If not set or any other value, JIRA prompt will be skipped.
- `JIRA_USER` – JIRA username for Basic Auth (required if `TOGGL_USE_JIRA=yes`)
- `JIRA_PASSWORD` – JIRA password for Basic Auth (required if `TOGGL_USE_JIRA=yes`)
- `JIRA_API_URL` – JIRA API base URL (required if `TOGGL_USE_JIRA=yes`)

## Aliasing
In your `.zshrc` add an alias such as `log-time` so this command runs from anywhere 

```bash
alias log-time='node --env-file=/path/to/.env ~/path/to/src/index.js'
```
