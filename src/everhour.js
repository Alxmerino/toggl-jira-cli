import {readFileSync, writeFileSync} from 'node:fs';
import {getQueryParams} from './utils.js';

const EVERHOUR_API_URL = 'https://api.everhour.com';
// ponytail: never expires; delete the file to pick up renamed or new tasks that a cached match hides
const CACHE_FILE = new URL('../.everhour-tasks.json', import.meta.url);
// Toggl tags matched by hand (e.g. OMR-Admin -> the OMR-1 task). Kept apart from the task cache, which is disposable
const MAPPINGS_FILE = new URL('../.everhour-mappings.json', import.meta.url);

const everhourClient = async (url, settings = {}) => {
    const method = settings.method || ('body' in settings ? 'POST' : 'GET');
    let URL = EVERHOUR_API_URL + url;

    if ('params' in settings) {
        URL = URL + '?' + getQueryParams(settings.params);
    }

    const response = await fetch(URL, {
        method,
        body: 'body' in settings ? JSON.stringify(settings.body) : undefined,
        headers: {
            'Content-Type': 'application/json',
            // Read per call: index.js may prompt for the key after this module loads
            'X-Api-Key': process.env.EVERHOUR_API_KEY
        }
    });

    if (response.status === 404 && settings.allow404) {
        return null;
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Everhour API error ${response.status} for ${method} ${url}${detail ? ': ' + detail.slice(0, 200) : ''}`);
    }

    return response.status === 204 ? null : response.json();
}

const readJson = (file) => {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return {};
    }
}

let cache, mappings;
const loadCache = () => cache ??= readJson(CACHE_FILE);

export const getMappings = () => mappings ??= readJson(MAPPINGS_FILE);

export const saveMapping = (tag, taskId) => {
    getMappings()[tag] = taskId;
    writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

const cacheTasks = (tasks) => {
    const cached = loadCache();
    const found = (tasks || []).filter(task => task?.id);
    for (const task of found) {
        const fields = {id: task.id, number: task.number, name: task.name, url: task.url};
        // Merge so a sparser copy (e.g. the task embedded in a time record) never blanks out known fields
        cached[task.id] = {...cached[task.id], ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null))};
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cached));
    return found.map(task => cached[task.id]);
}

const searchEverhour = async (query) => {
    return cacheTasks(await everhourClient('/tasks/search', {
        params: {query, limit: 20, searchInClosed: true}
    }));
}

// Cache first; Everhour is only asked when nothing cached matches every search term
export const searchTasks = async (query) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = Object.values(loadCache())
        .filter(t => terms.every(term => `${t.number ?? ''} ${t.name}`.toLowerCase().includes(term)));
    return matches.length ? matches.slice(0, 20) : searchEverhour(query);
}

export const getTask = async (taskId) => {
    return loadCache()[taskId] ?? cacheTasks([await everhourClient(`/tasks/${encodeURIComponent(taskId)}`)])[0];
}

export const getCurrentUser = async () => {
    return everhourClient('/users/me');
}

// Everhour gives a Jira-synced task an internal id (jr:8558-16511), not one
// built from the issue key, so the key has to be searched for. The key comes
// back on `number`, which the published API blueprint does not document.
const isIssue = (issueKey) => (task) => task.number === issueKey || (task.url || '').endsWith(`/browse/${issueKey}`);

// A hand-picked mapping wins, then a single cached match, then Everhour search
export const resolveTask = async (issueKey) => {
    const mapped = getMappings()[issueKey];
    if (mapped) {
        return getTask(mapped);
    }

    const cached = Object.values(loadCache()).filter(isIssue(issueKey));
    const candidates = cached.length === 1 ? cached : (await searchEverhour(issueKey)).filter(isIssue(issueKey));

    if (candidates.length === 1) {
        return candidates[0];
    }

    if (candidates.length > 1) {
        console.log(`⚠️  [WARN]  ${issueKey} matched ${candidates.length} Everhour tasks: ${candidates.map(c => c.id).join(', ')}`);
    }

    return null;
}

export const getTimeRecords = async (userId, date) => {
    const records = await everhourClient(`/users/${userId}/time`, {
        params: {from: date, to: date, limit: 5000}
    }) || [];
    cacheTasks(records.map(record => record.task));
    return records;
}

export const getLoggedSecondsByTask = async (userId, date) => {
    const byTask = new Map();
    for (const record of await getTimeRecords(userId, date)) {
        const taskId = record.task && record.task.id;
        if (!taskId) {
            continue;
        }
        byTask.set(taskId, (byTask.get(taskId) || 0) + record.time);
    }

    return byTask;
}

export const postTime = async ({taskId, date, seconds, comment, userId}) => {
    return everhourClient('/time', {
        body: {task: taskId, date, time: seconds, comment, user: userId}
    });
}

// PUT sets an existing record, POST adds a new one
export const saveTimeRecord = async (recordId, body) => {
    return recordId
        ? everhourClient(`/time/${recordId}`, {method: 'PUT', body})
        : everhourClient('/time', {body});
}

// Zeroes the record rather than removing the row; it stays in listings with
// time 0, which sums to nothing and leaves task totals untouched.
export const deleteTime = async (timeId) => {
    return everhourClient(`/time/${timeId}`, {method: 'DELETE'});
}
