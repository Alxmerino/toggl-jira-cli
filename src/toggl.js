import {getQueryParams, localDayRange, logError} from './utils.js';

const {TOGGL_TOKEN} = process.env;
const TOGGL_API_URL = 'https://api.track.toggl.com/api/v9';

const togglClient = async (url = '/', settings = {}) => {
    let URL = TOGGL_API_URL + url;
    if ('params' in settings) {
        URL = URL + '?' + getQueryParams(settings.params);
    }

    const response = await fetch(URL, {
        headers: {
            'Authorization': 'Basic ' + btoa(TOGGL_TOKEN + ':api_token')
        }
    });

    if (!response.ok) {
        logError(response);
        throw new Error(`Toggl API error ${response.status} for ${URL}`);
    }

    return response.json();
}

export const getWorkspaces = async () => {
    return togglClient(`/workspaces`);
}

export const getProject = async (workspaceId, projectId) => {
    if (!workspaceId || !projectId) {
        return;
    }
    return togglClient(`/workspaces/${workspaceId}/projects/${projectId}`);
}

export const getTodayEntries = async (date) => {
    const params = localDayRange(date);

    const displayDate = date === 'today' ? 'today' : date === 'yesterday' ? 'yesterday' : date;
    console.log('📝 [TOGGL]', `\x1b[32mGetting Entries for ${displayDate}\x1b[0m`);

    const entries = await togglClient('/me/time_entries', {params});
    if (!Array.isArray(entries)) {
        return [];
    }

    // A running entry reports a negative duration; logging it would poison the tag total.
    const running = entries.filter(entry => entry.duration < 0 || entry.stop === null);
    if (running.length > 0) {
        console.log(`⚠️  [WARN]  ${running.length} running entr${running.length === 1 ? 'y' : 'ies'} skipped — stop the timer first`);
    }

    return entries.filter(entry => entry.duration >= 0 && entry.stop !== null);
}
