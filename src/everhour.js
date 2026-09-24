import {readFileSync, writeFileSync} from 'node:fs';
import {getQueryParams} from './utils.js';

const EVERHOUR_API_URL = 'https://api.everhour.com';
// ponytail: never expires; delete the file to pick up renamed or new tasks that a cached match hides
const CACHE_FILE = new URL('../.everhour-tasks.json', import.meta.url);

// Unlike the Toggl/Jira clients this throws, so the web UI can show the error per row
const everhourClient = async (url, {method = 'GET', body} = {}) => {
    const response = await fetch(EVERHOUR_API_URL + url, {
        method,
        body: body && JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            // Read per call: index.js may prompt for the token after this module loads
            'X-Api-Key': process.env.EVERHOUR_TOKEN
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || `${response.status} ${response.statusText}`);
    }
    return data;
}

let cache;
const loadCache = () => {
    try {
        cache ??= JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    } catch {
        cache = {};
    }
    return cache;
}

const cacheTasks = (tasks) => {
    const cached = loadCache();
    for (const task of tasks.filter(t => t?.id)) {
        const fields = {id: task.id, number: task.number, name: task.name, url: task.url};
        // Merge so a sparser copy (e.g. the task embedded in a time record) never blanks out known fields
        cached[task.id] = {...cached[task.id], ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null))};
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cached));
    return tasks.filter(t => t?.id).map(t => cached[t.id]);
}

const searchEverhour = async (query) => {
    return cacheTasks(await everhourClient('/tasks/search?' + getQueryParams({query, limit: 10, searchInClosed: true})));
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

// Jira tasks in Everhour carry the issue key in `number`; search is fuzzy so match it exactly
export const findTaskByKey = async (issueKey) => {
    const byKey = task => task.number === issueKey;
    return Object.values(loadCache()).find(byKey) ?? (await searchEverhour(issueKey)).find(byKey);
}

export const getMyTimeRecords = async (date) => {
    const me = await everhourClient('/users/me');
    const records = await everhourClient(`/users/${me.id}/time?` + getQueryParams({from: date, to: date}));
    cacheTasks(records.map(r => r.task));
    return records;
}

// PUT sets an existing record, POST adds a new one
export const saveTimeRecord = async (recordId, body) => {
    return recordId
        ? everhourClient(`/time/${recordId}`, {method: 'PUT', body})
        : everhourClient('/time', {method: 'POST', body});
}
