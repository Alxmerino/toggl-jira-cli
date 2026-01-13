# Project Intake Report: Toggl-JIRA CLI

## 1. Project Identification

- **Project Name:** toggle-log / Toggl-JIRA CLI
- **Type:** Node.js CLI application
- **Primary Purpose:** Time logger that syncs time entries from Toggl.com to JIRA issue worklogs
- **Runtime:** Node.js 20.x (per README)
- **Package Manager:** npm
- **Module Type:** ES6 modules (`"type": "module"` in package.json)
- **Current Version:** 1.0.0
- **Author:** Rene Merino (rene@amayamedia.com)
- **License:** ISC

---

## 2. Environment & Deployment Summary

### 2.1 Node.js Runtime
- **Specified Version:** Node.js 20.x (from README)
- **Inference:** No `.nvmrc`, `.tool-versions`, or Dockerfile present, so version requirement is inferred from README only
- **Module System:** ES6 modules (modern, native support in Node 20.x)

### 2.2 Configuration & Environment
- **Environment Variables Required** (from code inspection):
  - `TOGGL_TOKEN` – API authentication for Toggl.com
  - `JIRA_USER` – JIRA username (Basic auth)
  - `JIRA_PASSWORD` – JIRA password (Basic auth)
  - `JIRA_API_URL` – JIRA API base URL
- **Delivery Method:** Node's native `--env-file` flag (Node 20.11.0+)
- **Configuration Management:** No `.env.example` file present; environment variables are hardcoded in source

### 2.3 Deployment & CI/CD
- **No CI/CD found:** No `.github/workflows/`, `.gitlab-ci.yml`, or similar
- **No Dockerfile:** Designed for local/manual execution
- **Installation Method:** Direct script execution via alias (recommended in README)
- **Testing:** None configured (`"test": "echo \"Error: no test specified\""`)

---

## 3. Dependency Overview (npm)

### 3.1 Production Dependencies (4 packages)

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `date-fns` | ^3.6.0 | Date/time manipulation | ✅ Current |
| `@date-fns/utc` | ^1.2.0 | UTC-aware date functions | ✅ Current |
| `@inquirer/confirm` | ^3.1.1 | Interactive CLI confirmation prompt | ✅ Current |
| `tty-table` | ^4.2.3 | Terminal table formatting | ✅ Current |

### 3.2 Dependency Health
- **Total Dependencies:** 4 (minimal and focused)
- **Update Status:** No known outdated packages (as of January 2026)
- **Security Considerations:** All dependencies are actively maintained
- **Note:** No lock file (`package-lock.json` or `yarn.lock`) is checked into the repo; this could lead to non-reproducible installs across environments

---

## 4. Architecture & Code Analysis

### 4.1 Module Structure

```
src/
├── index.js      – Main entry point; orchestrates Toggl → JIRA workflow
├── toggl.js      – Toggl API client
├── jira.js       – JIRA API client
└── utils.js      – Utility functions (date handling, formatting, CLI output)
```

### 4.2 Data Flow
1. **Fetch time entries** from Toggl for a given date (today/yesterday/YYYY-MM-DD)
2. **Group entries** by tag (JIRA issue key assumed to be in Toggl tags)
3. **Display summary table** of grouped entries with formatted durations
4. **Confirm with user** before posting to JIRA
5. **Post worklogs** to JIRA with time, comment, and start timestamp
6. **Report success/failure**

### 4.3 Key Design Observations

#### 4.3.1 Strengths
- Clear separation of concerns (Toggl client, JIRA client, utilities, main logic)
- ES6 async/await for readable async flows
- Color-coded console output for better UX
- Flexible date argument handling (today, yesterday, YYYY-MM-DD)
- Rounding logic to nearest 5-minute intervals (common in time tracking)

#### 4.3.2 Design Issues

**A. Assumption: JIRA issue key in Toggl tags**
- The code assumes time entries have tags, and the **first tag** is the JIRA issue key:
  ```javascript
  const key = obj.tags && obj.tags.length > 0 ? obj.tags[0] : 'no-tags';
  ```
- **Risk:** No validation that the tag is a valid JIRA issue key format
- **Missing:** No fallback or error if posting fails (e.g., invalid issue key)

**B. Basic authentication hardcoded**
- JIRA credentials sent as Basic Auth (username:password in Base64)
- **Risk:** If credentials are leaked (in env files, logs, git history), full JIRA access is compromised
- **Consideration:** JIRA recommends API tokens instead of passwords for automation

**C. Commented-out code**
- Lines 27–42 in `index.js` contain large blocks of commented-out logic (project fetching, merging logic)
- **Risk:** Dead code creates confusion; unclear if it was abandoned work or intentional
- **Recommendation:** Remove or create a Git branch to preserve it

**D. Minimal error handling**
- Both Toggl and JIRA clients log errors but don't explicitly stop execution
- Example: If JIRA posting fails silently, the CLI may report success when it shouldn't
- **Risk:** User may believe time was logged when it wasn't

**E. No idempotency / duplicate detection**
- Code comment suggests intention: `// @todo: Check if time has already been logged?`
- **Risk:** Running the script twice will double-log time to JIRA
- **Recommendation:** Implement a check before posting

**F. Hardcoded rounding to 5 minutes**
- `roundDuration(entry.duration, 5)` – assumes 5-minute billing increments
- **Risk:** Not configurable; may not match client's actual billing rules
- **Recommendation:** Make configurable or document clearly

#### 4.3.3 Code Quality Observations

- **No input validation:** Date parsing is regex-based with minimal error handling
- **Timezone handling:** Uses `@date-fns/utc` but mixes UTC and local time logic inconsistently
- **Magic numbers:** Hardcoded table widths (`width: 100`), color codes (`\x1b[32m`)
- **No logging framework:** Uses `console.log` with emoji; not suitable for production logging
- **No tests:** Zero test coverage; refactoring is risky

---

## 5. Security Analysis

### 5.1 High-Priority Concerns

1. **Environment Variable Exposure**
   - Credentials (`JIRA_USER`, `JIRA_PASSWORD`, `TOGGL_TOKEN`) stored in `.env` file
   - **Risk:** If `.env` is committed to git (common mistake), credentials are exposed permanently in history
   - **Check:** Verify `.gitignore` excludes `.env` (not visible in current workspace, but critical to confirm)

2. **Basic Authentication for JIRA**
   - Plain username:password Base64 encoding is weak
   - **Risk:** Intercepted over HTTPS (less likely), or leaked in logs
   - **Recommendation:** Use JIRA API tokens instead (more secure, can be revoked)

3. **No Input Validation**
   - Toggl tags are treated as JIRA issue keys without validation
   - **Risk:** Malformed issue keys could be sent to JIRA, or unexpected side effects
   - **Recommendation:** Validate issue key format (e.g., `[A-Z]+-\d+`)

4. **Error Responses Logged to Console**
   - JIRA errors include full response body, which may expose sensitive data
   - Example in `jira.js`:
     ```javascript
     console.log('🫠', {
         status: response.status,
         statusText: response.statusText,
         body: response.body,
     })
     ```
   - **Risk:** Logged to terminal history or logs
   - **Recommendation:** Sanitize error output; only log non-sensitive details

### 5.2 Medium-Priority Concerns

- **No rate limiting:** Could overwhelm APIs if a loop fails and retries aggressively
- **No timeout handling:** Fetch calls could hang indefinitely
- **Regex date parsing:** Fragile; doesn't validate day/month ranges (e.g., 2026-13-45 would be accepted)

---

## 6. Risks & Pitfalls

### 6.1 Maintainability
- **Dead code:** Commented blocks in `index.js` should be removed or documented
- **No versioning:** Dependencies not locked; `package-lock.json` should be committed
- **Hardcoded configuration:** Table widths, colors, rounding intervals are scattered throughout
- **Single person knowledge:** Only the author (Rene) likely understands the full intention

### 6.2 Reliability
- **No duplicate detection:** Running twice will log time twice to JIRA
- **Silent failures:** API errors may not propagate; user sees "success" when posting actually failed
- **Timezone edge cases:** UTC conversion logic appears correct but deserves testing around midnight transitions
- **Toggl tag assumption:** If Toggl tags are renamed or missing, entries silently drop to "no-tags" bucket (filtered out)

### 6.3 Operability
- **Manual execution only:** No scheduling mechanism (cron, systemd timer, etc.); must be run manually or via shell alias
- **Limited logging:** Emoji-based output is cute but not machine-parseable for monitoring
- **No dry-run mode:** User confirms visually but has no way to test without actually posting to JIRA
- **Alias required:** Users must add custom alias to `~/.zshrc`; fragile if path changes

### 6.4 Performance
- **Not applicable:** Single-user CLI tool with small data volumes (likely < 100 entries per day)

---

## 7. Suggested Next Steps for AI-Assisted Development

### 7.1 High-Impact Improvements
1. **Add input validation**
   - Validate JIRA issue key format before posting
   - Add date parsing error handling
   - Recommend: Create a `validators.js` utility module

2. **Remove dead code**
   - Delete or branch the commented code blocks in `index.js` (lines ~27–42)
   - Reason: Reduces cognitive load and source of bugs

3. **Implement duplicate detection**
   - Query JIRA worklog before posting
   - Check if entry for the same date already exists
   - Recommend: Add `hasWorklog(issueKey, date)` function to `jira.js`

4. **Improve error handling**
   - Wrap API calls in try/catch, propagate errors explicitly
   - Add a `--dry-run` flag to preview without posting
   - Return explicit success/failure status from API functions

5. **Commit `package-lock.json`**
   - Generate and commit to ensure reproducible installs across machines

### 7.2 Medium-Impact Improvements
6. **Refactor hardcoded values**
   - Move color codes, table widths, rounding intervals to a config object
   - Reason: Makes customization and testing easier

7. **Add `.env.example`**
   - Document required environment variables
   - Reason: Helps new users understand setup

8. **Upgrade to JIRA API tokens**
   - Replace `JIRA_PASSWORD` with `JIRA_API_TOKEN`
   - Update `jira.js` to use token auth
   - Reason: More secure and aligns with JIRA best practices

### 7.3 Safe for Automated Edits
- Removing commented code
- Adding input validation functions
- Extracting hardcoded values to config
- Adding `.env.example`

### 7.4 Areas Requiring Caution / Manual Review
- **Error handling:** Changes to error flow may mask bugs; needs testing
- **Date/timezone logic:** Any changes to UTC conversion need verification with edge cases (e.g., DST transitions)
- **API interaction:** Changes to JIRA/Toggl client logic need real API testing (can't mock without additional setup)

---

## 8. Technical Debt & Recommendations

| Item | Priority | Effort | Recommendation |
|------|----------|--------|-----------------|
| Remove commented code | High | Low | Delete lines 27–42 in index.js |
| Commit package-lock.json | High | Low | Run `npm install` and commit lock file |
| Add input validation | High | Medium | Create validators.js, add issue key & date format checks |
| Implement duplicate detection | High | Medium | Query JIRA worklog before posting; skip if exists |
| Replace Basic Auth | Medium | Medium | Switch to JIRA API token; update env var & jira.js |
| Add --dry-run flag | Medium | Medium | Parse argv, skip confirmation & posting if --dry-run |
| Extract config | Medium | Low | Create config.js with colors, widths, rounding, etc. |
| Add .env.example | Low | Low | Create file documenting all required vars |
| Add test suite | Low | High | Set up Jest or similar; cover date parsing, validation, API mocking |

---

## 9. Questions for the Engineer

### 9.1 Project Intent & Scope
1. **Is this tool actively used, or is it experimental?** If actively used, we should prioritize stability (duplicate detection, error handling).
2. **How many JIRA users / workspaces will use this?** If it's shared across a team, we should invest in robustness and documentation.

### 9.2 Integration & Environment
3. **What is the production environment?** Is it run on a CI/CD system (GitHub Actions, Jenkins), a shared server, or only locally?
4. **Are Toggl tags guaranteed to match JIRA issue keys?** Or do we need a mapping file / lookup table?
5. **What happens if a Toggl entry doesn't have a tag?** Should we skip it, prompt the user, or ask for a fallback issue key?
6. **Is there a schedule for running this?** (daily, weekly, ad-hoc via cron?) If regular, we may want a daemon or scheduled task.

### 9.3 Security & Credentials
7. **Where are `.env` credentials currently stored?** Are they in `.gitignore`? Confirm no `.env` files are in git history.
8. **Can we upgrade from JIRA Basic Auth to API tokens?** This would improve security significantly.
9. **Are JIRA and Toggl instances internal or cloud (SaaS)?** Affects network/auth considerations.

### 9.4 Data & Compliance
10. **Can time be logged to the same issue twice?** Or should we detect and warn if worklog already exists for a date?
11. **Are there billing implications if we accidentally double-log?** If so, duplicate detection is critical.
12. **Should we preserve audit trail of what was auto-logged?** (e.g., log file with timestamps, issue keys, amounts)

### 9.5 Desired Features & Direction
13. **Would a `--dry-run` mode be useful?** To preview changes without posting.
14. **Should we support time tracking for multiple team members** (e.g., a shared JIRA instance), or is it single-user?
15. **Are there any edge cases or failure modes you've encountered?** (e.g., timezone issues, partial failures, slow APIs)

### 9.6 Development Practices
16. **Is there an existing Git history / branch strategy?** Should we follow conventions for commits/PRs?
17. **Should we add automated tests?** If so, what's the acceptable complexity/setup cost?
18. **Is there a preferred Node.js version beyond 20.x?** (e.g., need to stay on LTS?)

---

## 10. Conclusion

This is a **well-scoped, focused CLI tool** with a clear purpose: syncing time from Toggl to JIRA. The code is readable and uses modern Node.js features appropriately.

**Key gaps:**
- No error handling for API failures
- Potential for duplicate logging
- Security considerations around credentials
- No tests or validation

**Recommended starting point for refactoring:**
1. Fix the `.env` file (ensure not committed)
2. Add duplicate detection to JIRA client
3. Remove commented code
4. Commit `package-lock.json`
5. Add basic input validation

These changes will take ~2–4 hours and significantly improve reliability and maintainability.
