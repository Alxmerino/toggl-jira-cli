import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {decimalTime, roundDuration} from './utils.js';
import {findTaskByKey, getMyTimeRecords, getTask, saveTimeRecord, searchTasks} from './everhour.js';

// Toggl tags you matched by hand (e.g. OMR-Admin -> the OMR-1 task). Kept apart from the task cache, which is disposable
const MAPPINGS_FILE = new URL('../.everhour-mappings.json', import.meta.url);
const readMappings = () => {
    try {
        return JSON.parse(readFileSync(MAPPINGS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

const json = (res, status, data) => {
    res.writeHead(status, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
}

export async function startWeb(date, groups) {
    console.log('⏳ [EVERHOUR]', `\x1b[32mMatching ${groups.length} issues to Everhour tasks\x1b[0m`);
    const records = await getMyTimeRecords(date);
    const mappings = readMappings();

    // ponytail: first record wins if the task already has several for this date
    const taskFields = (task) => {
        const record = task && records.find(r => r.task?.id === task.id);
        return {
            taskId: task?.id,
            taskName: task?.name,
            url: task?.url,
            recordId: record?.id,
            loggedHours: record ? decimalTime(record.time) : null,
            recordComment: record?.comment
        };
    };

    // ponytail: one search per issue in parallel; Everhour allows ~20 req/10s, so batch this if a day ever has 15+ issues
    const rows = await Promise.all(groups.map(async (group) => {
        const mapped = group.tag in mappings;
        const task = await (mapped ? getTask(mappings[group.tag]) : findTaskByKey(group.tag)).catch(() => null);
        const fields = taskFields(task);
        return {
            key: group.tag,
            mapped,
            ...fields,
            hours: decimalTime(roundDuration(group.duration)),
            comment: fields.recordComment ?? [...new Set(group.entries.map(e => e.description).filter(Boolean))].join('; ')
        };
    }));

    // A mapped task that another row already uses would make both rows overwrite one Everhour record
    for (const row of rows) {
        const other = row.mapped && row.taskId && rows.find(r => r !== row && r.taskId === row.taskId);
        if (other) Object.assign(row, taskFields(null), {note: `Mapped task is already on ${other.key}; pick another`});
    }

    const setTask = async (row, taskId) => {
        // Two rows on one task would overwrite each other's Everhour record
        const other = rows.find(r => r !== row && r.taskId === taskId);
        if (other) throw new Error(`Already assigned to ${other.key}; put the hours on that row`);
        if (row.logged) throw new Error(`Already logged to ${row.taskName}; move that entry in Everhour`);
        Object.assign(row, taskFields(await getTask(taskId)), {mapped: true, note: undefined});
        mappings[row.key] = taskId;
        writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
        console.log('🔗 [EVERHOUR]', `\x1b[93m${row.key}\x1b[0m`, `mapped to ${row.taskName}, saved for next time`);
        return row;
    };

    const logTime = async (row, {hours, comment}) => {
        if (!row.taskId) throw new Error('No Everhour task for this row');
        if (!(hours > 0 && hours <= 24)) throw new Error('Hours must be between 0 and 24');

        const time = Math.round(hours * 60) * 60;
        const record = await saveTimeRecord(row.recordId, {task: row.taskId, date, time, comment});
        row.recordId = record.id;
        row.loggedHours = decimalTime(time);
        row.comment = comment;
        row.logged = true;
        console.log('🚀 [EVERHOUR]', `\x1b[93m${row.key}\x1b[0m`, `${row.loggedHours}h logged`);
        return row;
    };

    const page = await readFile(new URL('./web.html', import.meta.url));

    // Each open tab holds an /alive stream; when the last one drops, shut down after a grace period that covers a reload
    let tabs = 0, closing;
    const watchTab = (req, res) => {
        res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
        res.write(': connected\n\n');
        tabs++;
        clearTimeout(closing);
        req.on('close', () => {
            if (--tabs > 0) return;
            closing = setTimeout(() => {
                console.log('👋 [EVERHOUR]', 'Tab closed, shutting down');
                // close() rather than process.exit(), so a save still talking to Everhour finishes first
                server.close();
            }, 3000);
        });
    };

    const server = http.createServer(async (req, res) => {
        const {pathname, searchParams} = new URL(req.url, 'http://127.0.0.1');
        try {
            if (req.method === 'GET' && pathname === '/') {
                res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
                return res.end(page);
            }
            if (req.method === 'GET' && pathname === '/alive') {
                return watchTab(req, res);
            }
            if (req.method === 'GET' && pathname === '/rows') {
                return json(res, 200, {date, rows});
            }
            if (req.method === 'GET' && pathname === '/search') {
                const tasks = await searchTasks(searchParams.get('q'));
                return json(res, 200, tasks.map(task => ({
                    id: task.id,
                    label: [task.number, task.name].filter(Boolean).join(' · ')
                })));
            }
            // Requiring a JSON content type forces a CORS preflight, so other sites can't post here
            if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
                let body = '';
                for await (const chunk of req) body += chunk;
                const input = JSON.parse(body);
                const row = Number.isInteger(input.i) && rows[input.i];
                if (!row) throw new Error('Unknown row');
                if (pathname === '/task') return json(res, 200, await setTask(row, input.taskId));
                if (pathname === '/log') return json(res, 200, await logTime(row, input));
            }
            res.writeHead(404).end();
        } catch (error) {
            json(res, 500, {error: error.message});
        }
    });

    server.listen(0, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${server.address().port}`;
        console.log('🌐 [EVERHOUR]', `\x1b[32m${url}\x1b[0m`, '(closes with the tab, or Ctrl+C)');
        execFile('open', [url]);
    });
}
