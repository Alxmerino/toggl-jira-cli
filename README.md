# Toggl to JIRA CLI

CLI tool to log my time from Toggl to JIRA

## Prerequisite
This is tested and working on NodeJS 20.x

## Usage
Run `node --env-file=.env ./src/index.js` to log today's time. It also accept a date argument such as `today`, `yesterday` or in `YYYY-MM-DD` formtat.

## Aliasing
In your `.zshrc` add an alias such as `log-time` so this command runs from anywhere 

```bash
alias log-time='node --env-file=/path/to/.env ~/path/to/src/index.js'
```
