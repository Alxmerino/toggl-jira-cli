import {getQueryParams} from './utils.js';

const {EVERHOUR_API_KEY} = process.env;
const EVERHOUR_API_URL = 'https://api.everhour.com';

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
            'X-Api-Key': EVERHOUR_API_KEY
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

export const getCurrentUser = async () => {
    return everhourClient('/users/me');
}

// Everhour gives a Jira-synced task an internal id (jr:8558-16511), not one
// built from the issue key, so the key has to be searched for. The key comes
// back on `number`, which the published API blueprint does not document.
export const resolveTask = async (issueKey) => {
    const hits = await everhourClient('/tasks/search', {
        params: {query: issueKey, limit: 20, searchInClosed: true}
    });

    const candidates = (hits || []).filter(task =>
        task.number === issueKey || (task.url || '').endsWith(`/browse/${issueKey}`)
    );

    if (candidates.length === 1) {
        return candidates[0];
    }

    if (candidates.length > 1) {
        console.log(`⚠️  [WARN]  ${issueKey} matched ${candidates.length} Everhour tasks: ${candidates.map(c => c.id).join(', ')}`);
    }

    return null;
}

export const getLoggedSecondsByTask = async (userId, date) => {
    const records = await everhourClient(`/users/${userId}/time`, {
        params: {from: date, to: date, limit: 5000}
    });

    const byTask = new Map();
    for (const record of records || []) {
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

// Zeroes the record rather than removing the row; it stays in listings with
// time 0, which sums to nothing and leaves task totals untouched.
export const deleteTime = async (timeId) => {
    return everhourClient(`/time/${timeId}`, {method: 'DELETE'});
}
