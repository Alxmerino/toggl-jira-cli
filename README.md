# Toggl to Everhour CLI

CLI tool to log my time from Toggl to Everhour

## Prerequisite
This is tested and working on NodeJS 20.x

## Setup
Copy `.env.example` to `.env` and fill in:

- `TOGGL_TOKEN` — Toggl profile page, API token
- `EVERHOUR_API_KEY` — Everhour profile page, bottom

Toggl entries are matched to Everhour tasks by their first tag, which must be
the Jira issue key (e.g. `NSFW-2054`). Untagged entries are skipped.

## Usage
Run `node --env-file=.env ./src/index.js` to log today's time. It also accepts a
date argument such as `today`, `yesterday` or `YYYY-MM-DD`.

Time is grouped by tag, and you pick which entries to log before anything is
sent. Time already recorded in Everhour for that day is subtracted, so a rerun
tops up rather than double-logging.

## Aliasing
In your `.zshrc` add an alias such as `log-time` so this command runs from anywhere 

```bash
alias log-time='node --env-file=/path/to/.env ~/path/to/src/index.js'
```
