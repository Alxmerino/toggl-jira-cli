import confirm from '@inquirer/confirm';
import Table from 'tty-table';
import {format, subDays} from "date-fns";
import {header, footer, humanTime, formatTime, roundDuration, resolveDateArg, humanReadableDate} from './utils.js';
import {getTodayEntries, getProject, getWorkspaces} from './toggl.js';
import {postIssueWorklog} from './jira.js';

(async function () {
    let logDate = process.argv.slice(2)[0];
    if (!logDate) {
        logDate = 'today';
    }

    let totalTimeWorked = 0;
    let totalTimeLogged = 0;
    const resolvedDate = humanReadableDate(resolveDateArg(logDate));
    console.log(`Logging time entries for \x1b[32m${resolvedDate}\x1b[0m`)

    const [workspace] = await getWorkspaces();
    // Get today's entries
    let entries = await getTodayEntries(logDate);

    // Group entries by project ID
    const groupedEntries = entries.reduce((acc, obj) => {
        const key = obj.tags && obj.tags.length > 0 ? obj.tags[0] : 'no-tags';

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
    }, {});

    // Get the duration of all the entries for the same tag group
    const totalDurationByTag = Object.entries(groupedEntries).map(([tag, entries]) => {
        const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
        return {
            tag,
            duration: totalDuration,
            description: entries[0].description || '',
            entries: entries.map(entry => ({
                ...entry,
                duration: roundDuration(entry.duration)
            }))
        };
    }).filter(entry => entry.tag && entry.tag !== 'no-tags' && entry.duration > 0);

    // console.log('totalDurationByTag', totalDurationByTag)


    // // Merge objects with the same description
    // let combinedEntries = Object.values(groupedEntries).map(group => {
    //     return group.reduce((acc, obj) => {
    //         Object.keys(obj).forEach(key => {
    //             if (!acc.hasOwnProperty(key)) {
    //                 acc[key] = obj[key];
    //             } else if (Array.isArray(acc[key])) {
    //                 acc[key] = acc[key].concat(obj[key]);
    //             // } else if (key === 'description' && acc[key] !== obj[key]) {
    //             //     console.log(obj)
    //             } else if (key === 'duration') {
    //                 acc[key] += obj[key];
    //             }
    //         });
    //         return acc;
    //     }, {});
    // });
    //
    // // console.log(combinedEntries)



    // Loop through all entries and log the time to JIRA
    // for (let entry of totalDurationByTag) {
    //     const project = await getProject(workspace.id, entry.project_id);
    //
    //     if (project) {
    //         entry.project_name = project.name
    //     }
    // }

    // Show all entries in a table
    const timeEntriesTable = Table(header, totalDurationByTag, footer, {width: 100, compact: true}).render();
    console.log(timeEntriesTable)


    const logTime = await confirm({
        message: `Do you want to log the time above to JIRA for \x1b[32m${resolvedDate}\x1b[0m?`,
        default: false
    });
    if (logTime) {
        for (let entry of totalDurationByTag) {
            totalTimeWorked += entry.duration;

            console.log('💼 [JIRA]  Logging entry:', `\x1b[93m${entry.tag} \x1b[0m`);
            console.log('⏱️ [JIRA]  Time worked', `\x1b[93m${humanTime(roundDuration(entry.duration))} \x1b[0m`);

            // @todo: Check if time has already been logged?
            // const worklog = true;
            const worklog = await postIssueWorklog(entry.tag, {
                comment: entry.description,
                // for each entry.entries, get the earliest start time
                started: formatTime(entry.entries.reduce((earliest, current) => {
                    return current.start < earliest.start ? current : earliest;
                }).start) + '.0+0000',
                // started: formatTime(entry.start) + '.0+0000',
                timeSpentSeconds: roundDuration(entry.duration)
            });
        //
            if (worklog) {
                totalTimeLogged += roundDuration(entry.duration);
                console.log('🚀 [JIRA]  Time logged successfully');
            }
        }

        if (totalTimeWorked > 0 && totalTimeLogged > 0) {
            console.log('🏁 [SUCCESS] Total Time Worked', `\x1b[92m${humanTime(roundDuration(totalTimeWorked))}\x1b[0m`);
            console.log('🏁 [SUCCESS] Total Time Logged', `\x1b[92m${humanTime(roundDuration(totalTimeLogged))}\x1b[0m`);
        } else {
            console.log('🕗 Total Time Worked', `\x1b[92m${humanTime(roundDuration(totalTimeWorked))}\x1b[0m`);
            console.log('🕗', `\x1b[92mAre you still working?!\x1b[0m`);
        }
    }
})();
