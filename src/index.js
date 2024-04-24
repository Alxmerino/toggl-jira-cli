import confirm from '@inquirer/confirm';
import Table from 'tty-table';
import {format, subDays} from "date-fns";
import {header, footer, humanTime, formatTime, roundDuration, resolveDateArg, humanReadableDate} from './utils.js';
import {getTodayEntries, getProject, getWorkspaces} from './toggl.js';
import {postIssueWorklog} from './jira.js';

(async function () {
    let logDate = process.argv.slice(2)[0];
    if (!logDate) {
        const logToday = await confirm({message: 'Log today\'s time?'});
        if (!logToday) {
            return;
        }

        logDate = 'today';
    }

    let totalTimeWorked = 0;
    let totalTimeLogged = 0;
    const resolvedDate = humanReadableDate(resolveDateArg(logDate));
    console.log(`Loggin time entries for \x1b[32m${resolvedDate}\x1b[0m`)

    const [workspace] = await getWorkspaces();
    // Get today's entries
    let entries = await getTodayEntries(logDate);

    // Group entries by project ID
    const groupedEntries = entries.reduce((acc, obj) => {
        const key = obj.project_id;

        if (key === null) {
            return acc;
        }

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
    }, {});

    // Merge objects with the same description
    let combinedEntries = Object.values(groupedEntries).map(group => {
        return group.reduce((acc, obj) => {
            Object.keys(obj).forEach(key => {
                if (!acc.hasOwnProperty(key)) {
                    acc[key] = obj[key];
                } else if (Array.isArray(acc[key])) {
                    acc[key] = acc[key].concat(obj[key]);
                } else if (key === 'duration') {
                    acc[key] += obj[key];
                }
            });
            return acc;
        }, {});
    });

    // Loop through all entries and log the time to JIRA
    for (let entry of combinedEntries) {
        const project = await getProject(workspace.id, entry.project_id);

        if (project) {
            entry.project_name = project.name
        }
    }

    const timeEntriesTable = Table(header, combinedEntries, footer, {width: 100, compact: true}).render()
    // Show the table on the console
    console.log(timeEntriesTable)

    const logTime = await confirm({message: 'Log time?'});

    if (logTime) {
        for (let entry of combinedEntries) {
            totalTimeWorked += entry.duration;

            console.log('💼 [JIRA]  Logging entry:', `\x1b[93m${entry.project_name} \x1b[0m`);
            console.log('⏱️  [JIRA]  Time worked', `\x1b[93m${humanTime(roundDuration(entry.duration))} \x1b[0m`);

            // @todo: Check if time has already been logged?
            // const worklog = true;
            const worklog = await postIssueWorklog(entry.project_name, {
                comment: entry.description,
                started: formatTime(entry.start) + '.0+0000',
                timeSpentSeconds: roundDuration(entry.duration)
            });

            if (worklog) {
                totalTimeLogged += roundDuration(entry.duration);
                console.log('🚀 [JIRA]  Time logged successfully');
            }
        }

        if (totalTimeWorked > 0 && totalTimeLogged > 0) {
            console.log('🏁 [SUCCESS] Total Time Worked', `\x1b[92m${humanTime(totalTimeWorked)}\x1b[0m`);
            console.log('🏁 [SUCCESS] Total Time Logged', `\x1b[92m${humanTime(totalTimeLogged)}\x1b[0m`);
        } else {
            console.log('🕗 Total Time Worked', `\x1b[92m${humanTime(totalTimeWorked)}\x1b[0m`);
            console.log('🕗', `\x1b[92mAre you still working?!\x1b[0m`);
        }
    }
})();
