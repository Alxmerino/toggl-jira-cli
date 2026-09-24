import confirm from '@inquirer/confirm';
import Table from 'tty-table';
import {format, subDays} from "date-fns";
import {header, footer, humanTime, formatTime, roundDuration, resolveDateArg, humanReadableDate} from './utils.js';
import {getTodayEntries, getProject, getWorkspaces} from './toggl.js';
import {postIssueWorklog} from './jira.js';
import {startWeb} from './web.js';
import {createInterface} from 'node:readline/promises';
import {execFile} from 'node:child_process';

(async function () {
    // `log` opens the Everhour web UI after the summary; any other arg is the date
    const args = process.argv.slice(2);
    const openWeb = args.includes('log');
    const [logDate = 'today'] = args.filter(arg => arg !== 'log');

    if (openWeb && !process.env.EVERHOUR_TOKEN) {
        const profileUrl = 'https://app.everhour.com/#/account/profile';
        console.log(`🔑 \x1b[93mEVERHOUR_TOKEN is not set.\x1b[0m Opening ${profileUrl}; the API key is at the bottom of the page.`);
        execFile('open', [profileUrl]);
        const rl = createInterface({input: process.stdin, output: process.stdout});
        process.env.EVERHOUR_TOKEN = (await rl.question('Paste your Everhour API key (Enter to cancel): ')).trim();
        rl.close();
        if (!process.env.EVERHOUR_TOKEN) process.exit(1);
        console.log('💡 Add \x1b[32mexport EVERHOUR_TOKEN=<key>\x1b[0m to your shell profile to skip this next time.\n');
    }

    let totalTimeWorked = 0;
    let totalTimeLogged = 0;
    const resolvedDate = humanReadableDate(resolveDateArg(logDate));
    console.log(`Logging time entries for \x1b[32m${resolvedDate}\x1b[0m`)

    const [workspace] = await getWorkspaces();
    // Get today's entries
    let entries = await getTodayEntries(logDate);

    // Fetch project names for all unique project IDs
    const uniqueProjectIds = [...new Set(entries.map(e => e.project_id).filter(Boolean))];
    const projectMap = {};
    for (const projectId of uniqueProjectIds) {
        const project = await getProject(workspace.id, projectId);
        if (project) {
            projectMap[projectId] = project.name;
        }
    }

    // Add project_name to each entry
    entries = entries.map(entry => ({
        ...entry,
        project_name: projectMap[entry.project_id] || 'No Project'
    }));

    // Group entries by tag (only Billable entries for the table)
    const billableEntries = entries.filter(entry => entry.project_name === 'Billable');
    const groupedEntries = billableEntries.reduce((acc, obj) => {
        const keys = obj.tags && obj.tags.length > 0 ? obj.tags : ['no-tags'];

        for (const key of keys) {
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(obj);
        }
        return acc;
    }, {});

    // Sort grouped entries by issue key
    const sortedGroupedEntries = Object.keys(groupedEntries).sort().reduce((obj, key) => {
        obj[key] = groupedEntries[key];
        return obj;
    }, {});

    // Get the duration of all the entries for the same tag group
    const totalDurationByTag = Object.entries(sortedGroupedEntries).map(([tag, entries]) => {
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


    // for (let entry of totalDurationByTag) {
    //     const project = await getProject(workspace.id, entry.project_id);
    
    //     if (project) {
    //         entry.project_name = project.name
    //     }
    // }

    // Show all entries in a table
    const timeEntriesTable = Table(header, totalDurationByTag, footer, {width: 100, compact: true}).render();
    console.log(timeEntriesTable)

    // Calculate and display hours by project
    const hoursByProject = entries.reduce((acc, entry) => {
        const projectName = entry.project_name || 'No Project';
        if (!acc[projectName]) {
            acc[projectName] = 0;
        }
        if (entry.duration > 0) {
            acc[projectName] += entry.duration;
        }
        return acc;
    }, {});

    console.log('\n📊 Hours by Project:');
    let grandTotal = 0;
    Object.entries(hoursByProject).sort().forEach(([project, duration]) => {
        const roundedDuration = roundDuration(duration);
        grandTotal += roundedDuration;
        console.log(`   ${project}: \x1b[93m${humanTime(roundedDuration)}\x1b[0m`);
    });
    console.log(`   ─────────────────`);
    console.log(`   Total: \x1b[92m${humanTime(grandTotal)}\x1b[0m`);
    console.log(`   Tickets worked on: \x1b[92m${totalDurationByTag.length}\x1b[0m\n`);

    // Everhour replaces the Jira worklog flow: hand the grouped entries to the local web UI
    if (openWeb) {
        return startWeb(format(resolveDateArg(logDate), 'yyyy-MM-dd'), totalDurationByTag).catch(error => {
            console.error('🫠 \x1b[31m[EVERHOUR]\x1b[0m', error.message, '(check EVERHOUR_TOKEN)');
            process.exit(1);
        });
    }

    // Check if JIRA integration is enabled
    const includeJira = process.env.TOGGL_USE_JIRA?.toLowerCase() === 'yes';
    
    if (!includeJira) {
        process.exit(0);
    }

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
