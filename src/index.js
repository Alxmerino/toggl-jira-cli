import 'dotenv/config';
import confirm from '@inquirer/confirm';
import checkbox from '@inquirer/checkbox';
import Table from 'tty-table';
import {header, footer, humanTime, toApiDate, roundDuration, resolveDateArg, humanReadableDate} from './utils.js';
import {getTodayEntries, getProject, getWorkspaces} from './toggl.js';
import {postTime, getCurrentUser, getLoggedSecondsByTask, resolveTask} from './everhour.js';
import {startWeb} from './web.js';
import {createInterface} from 'node:readline/promises';
import {execFile} from 'node:child_process';

// Ctrl+C at a prompt should read as "cancelled", not as a stack trace.
const handleFatal = (error) => {
    // Two @inquirer/core copies are installed, so instanceof is unreliable here.
    if (error && (error.name === 'ExitPromptError' || error.constructor?.name === 'ExitPromptError')) {
        console.log('\n🛑', `\x1b[33mCancelled. Nothing logged.\x1b[0m`);
        process.exit(0);
    }
    console.error('💥', error && error.message ? error.message : error);
    process.exit(1);
};

(async function () {
    // `toggl [date]` only reports. `toggl log [date]` pushes to Everhour: the web page by default, the checkbox flow with --cli
    const args = process.argv.slice(2);
    const push = args.includes('log');
    const openWeb = push && !args.includes('--cli');
    const logDate = args.find(arg => arg !== 'log' && !arg.startsWith('--')) ?? 'today';

    if (!process.env.EVERHOUR_API_KEY) {
        const profileUrl = 'https://app.everhour.com/#/account/profile';
        console.log(`🔑 \x1b[93mEVERHOUR_API_KEY is not set.\x1b[0m Opening ${profileUrl}; the API key is at the bottom of the page.`);
        execFile('open', [profileUrl]);
        const rl = createInterface({input: process.stdin, output: process.stdout});
        process.env.EVERHOUR_API_KEY = (await rl.question('Paste your Everhour API key (Enter to cancel): ')).trim();
        rl.close();
        if (!process.env.EVERHOUR_API_KEY) process.exit(1);
        console.log('💡 Add \x1b[32mexport EVERHOUR_API_KEY=<key>\x1b[0m to your shell profile to skip this next time.\n');
    }

    let totalTimeWorked = 0;
    let totalTimeLogged = 0;
    const logDay = resolveDateArg(logDate);
    const resolvedDate = humanReadableDate(logDay);
    console.log(`${push ? 'Logging time entries' : 'Time entries'} for \x1b[32m${resolvedDate}\x1b[0m`);

    let entries = await getTodayEntries(logDate);
    entries = Array.isArray(entries) ? entries : [];

    // Optional per-person filter, e.g. TOGGL_PROJECTS=Billable when non-billable time is tracked in Toggl too
    const onlyProjects = (process.env.TOGGL_PROJECTS || '').split(',').map(name => name.trim()).filter(Boolean);
    if (onlyProjects.length > 0) {
        const [workspace] = await getWorkspaces();
        const projectIds = [...new Set(entries.map(entry => entry.project_id).filter(Boolean))];
        // Sequential, as before: Toggl rate-limits bursts
        const projects = [];
        for (const id of projectIds) {
            projects.push(await getProject(workspace.id, id));
        }
        const keep = new Set(projects.filter(p => p && onlyProjects.includes(p.name)).map(p => p.id));
        const skipped = entries.filter(entry => !keep.has(entry.project_id)).length;
        entries = entries.filter(entry => keep.has(entry.project_id));
        if (skipped > 0) {
            console.log(`ℹ️  [INFO]  ${skipped} entr${skipped === 1 ? 'y' : 'ies'} outside ${onlyProjects.join(', ')} left out`);
        }
    }

    const groupedEntries = entries.reduce((acc, obj) => {
        const key = obj.tags && obj.tags.length > 0 ? obj.tags[0] : 'no-tags';
        if (!acc[key]) acc[key] = [];
        acc[key].push(obj);
        return acc;
    }, {});

    const untaggedCount = (groupedEntries['no-tags'] || []).length;
    if (untaggedCount > 0) {
        console.log(`⚠️  [WARN]  ${untaggedCount} entr${untaggedCount === 1 ? 'y' : 'ies'} skipped — no issue tag`);
    }

    const totalDurationByTag = Object.entries(groupedEntries).map(([tag, tagEntries]) => {
        const totalDuration = tagEntries.reduce((sum, entry) => sum + entry.duration, 0);
        const descriptions = [...new Set(tagEntries.map(e => e.description).filter(Boolean))];
        return {
            tag,
            duration: totalDuration,
            description: descriptions.join(', ') || 'No description',
            entries: tagEntries.map(entry => ({
                ...entry,
                duration: roundDuration(entry.duration)
            }))
        };
    }).filter(entry => entry.tag !== 'no-tags' && entry.duration > 0);

    if (totalDurationByTag.length === 0) {
        console.log('🕗', `\x1b[92mNo entries found. Are you still working?!\x1b[0m`);
        return;
    }

    const apiDate = toApiDate(logDay);

    // Ask Everhour what it already holds for this day, so a rerun tops up
    // instead of double-logging. One call covers every task.
    console.log('🔎 [EVERHOUR]  Checking for time already logged...');
    const me = await getCurrentUser();
    const loggedByTask = await getLoggedSecondsByTask(me.id, apiDate);

    const unresolved = [];
    for (const entry of totalDurationByTag) {
        const task = await resolveTask(entry.tag);
        entry.taskId = task ? task.id : null;
        entry.alreadyLogged = task ? (loggedByTask.get(task.id) || 0) : 0;
        entry.remaining = task ? Math.max(0, roundDuration(entry.duration) - entry.alreadyLogged) : 0;
        if (!task) {
            unresolved.push(entry.tag);
        }
    }

    for (const tag of unresolved) {
        console.log(push ? '❓ [SKIP]  ' : '❓ [NO TASK]', `\x1b[33m${tag} has no matching Everhour task${openWeb ? '; pick one on the page' : ''}\x1b[0m`);
    }

    const timeEntriesTable = Table(header, totalDurationByTag, footer, {width: 120, compact: true}).render();
    console.log(timeEntriesTable);
    console.log(`   Tickets worked on: \x1b[92m${totalDurationByTag.length}\x1b[0m\n`);

    if (!push) {
        return;
    }

    if (openWeb) {
        return startWeb(apiDate, totalDurationByTag);
    }

    const loggable = totalDurationByTag.filter(entry => entry.taskId && entry.remaining > 0);
    const settled = totalDurationByTag.filter(entry => entry.taskId && entry.remaining === 0);

    for (const entry of settled) {
        console.log('✅ [SKIP]  ', `\x1b[90m${entry.tag} already fully logged (${humanTime(entry.alreadyLogged)})\x1b[0m`);
    }

    if (loggable.length === 0) {
        console.log('🎉', `\x1b[92mNothing left to log for ${resolvedDate}.\x1b[0m`);
        return;
    }

    const selectedTags = await checkbox({
        message: `Select entries to log to Everhour on ${resolvedDate}`,
        choices: loggable.map(entry => ({
            name: `${entry.tag.padEnd(12)} ${humanTime(entry.remaining).padEnd(16)} ${entry.alreadyLogged > 0 ? `(topping up ${humanTime(entry.alreadyLogged)} already logged) ` : ''}${entry.description}`,
            value: entry.tag,
            // Without this the submitted-answer line reprints every full label.
            short: entry.tag,
            checked: true
        })),
        pageSize: 15
    });

    const selected = loggable.filter(entry => selectedTags.includes(entry.tag));

    if (selected.length === 0) {
        console.log('🛑', `\x1b[33mNothing selected. Nothing logged.\x1b[0m`);
        return;
    }

    const grandTotal = selected.reduce((sum, e) => sum + e.remaining, 0);
    const proceed = await confirm({
        message: `Log ${humanTime(grandTotal)} across ${selected.length} issue${selected.length === 1 ? '' : 's'} to Everhour on ${resolvedDate}?`,
        default: false
    });

    if (!proceed) {
        console.log('🛑', `\x1b[33mNothing logged.\x1b[0m`);
        return;
    }

    for (let entry of selected) {
        totalTimeWorked += entry.remaining;

        console.log('💼 [EVERHOUR]  Logging entry:', `\x1b[93m${entry.tag} \x1b[0m`);
        console.log('⏱️ [EVERHOUR]  Time worked', `\x1b[93m${humanTime(entry.remaining)} \x1b[0m`);

        try {
            const record = await postTime({
                taskId: entry.taskId,
                date: apiDate,
                seconds: entry.remaining,
                comment: entry.description,
                userId: me.id
            });

            if (record) {
                totalTimeLogged += entry.remaining;
                console.log('🚀 [EVERHOUR]  Time logged successfully');
            }
        } catch (error) {
            console.error(`❌ [EVERHOUR]  Failed to log ${entry.tag}:`, error.message);
        }
    }

    if (totalTimeLogged > 0) {
        console.log('🏁 [SUCCESS] Total Time Attempted', `\x1b[92m${humanTime(totalTimeWorked)}\x1b[0m`);
        console.log('🏁 [SUCCESS] Total Time Logged', `\x1b[92m${humanTime(totalTimeLogged)}\x1b[0m`);
    } else {
        console.log('❌ [FAILED]  Time selected but nothing logged');
        console.log('⏱️  Time Selected', `\x1b[92m${humanTime(totalTimeWorked)}\x1b[0m`);
    }
})().catch(handleFatal);
