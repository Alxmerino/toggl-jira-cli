# Toggl to Everhour CLI

CLI tool to log my time from Toggl to Everhour

## Prerequisite
This is tested and working on NodeJS 20.x

## Setup
Copy `.env.example` to `.env` and fill in:

- `TOGGL_TOKEN` — Toggl profile page, API token
- `EVERHOUR_API_KEY` — Everhour profile page, bottom. If it is not set, the CLI
  opens that page and asks you to paste the key for the run.
- `TOGGL_PROJECTS` (optional) — comma-separated Toggl project names, e.g.
  `Billable`. When set, only entries in those projects count. Leave it unset to
  count everything.

Toggl entries are matched to Everhour tasks by their first tag, which must be
the Jira issue key (e.g. `NSFW-2054`). Untagged entries are skipped.

## Usage
Run `node --env-file=.env ./src/index.js` to log today's time. It also accepts a
date argument such as `today`, `yesterday`, `YYYY-MM-DD` or `MM-DD`.

Time is grouped by tag, and you pick which entries to log before anything is
sent. Time already recorded in Everhour for that day is subtracted, so a rerun
tops up rather than double-logging.

### Web page (`log`)
Add `log` (e.g. `./src/index.js log` or `./src/index.js log yesterday`) to open a
local page after the summary instead of the checkbox prompt. Each issue gets an
editable hours field and a comment, logged to Everhour one row at a time or all
at once.

- Hours on the page are the day's total for that task. Saving again updates the
  Everhour record instead of adding another, so a rerun never doubles time.
- Issues with no matching Everhour task get a search box. The task you pick is
  saved in `.everhour-mappings.json` and used for that tag from then on, by both
  the page and the checkbox flow.
- Found tasks are cached in `.everhour-tasks.json`; search only asks Everhour
  when nothing cached matches. The file is safe to delete.
- The CLI shuts down a few seconds after the last tab closes.

## Aliasing
In your `.zshrc` add an alias such as `log-time` so this command runs from anywhere 

```bash
alias log-time='node --env-file=/path/to/.env ~/path/to/src/index.js'
```
