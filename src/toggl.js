import {subDays, format, addDays} from "date-fns";
import {getQueryParams, logError, resolveDateArg} from './utils.js';

const {TOGGL_TOKEN} = process.env;
const TOGGL_API_URL = 'https://api.track.toggl.com/api/v9';

const toggleClient = async (url = '/', settings = {}) => {
    let URL = TOGGL_API_URL + url;
    if ('params' in settings) {
        const {params} = settings;
        URL = URL + '?' + getQueryParams(params);
    }


    return fetch(URL, {
        headers: {
            'Authorization': 'Basic ' + btoa(TOGGL_TOKEN + ':api_token')
        }
    })
        .then(response => {
            if (!response.ok) {
                logError(response)
                throw new Error('Network response was not ok for ', URL);
            }
            return response.json();
        })
        .catch(error => {
            console.error('❌ There was a problem with the fetch operation:', error);
        });
}

export const getWorkspaces = async () => {
    return toggleClient(`/workspaces`)
}

export const getProject = async (workspaceId, projectId) => {
    if (!workspaceId || !projectId) {
        return;
    }
    return toggleClient(`/workspaces/${workspaceId}/projects/${projectId}`)
}

export const getTodayEntries = async (date) => {
    const params = {};
    let displayDate = 'today';
    let startDate;

    if (date === 'today') {
        startDate = resolveDateArg('today');
        displayDate = 'today';
    } else if (date === 'yesterday') {
        startDate = resolveDateArg('yesterday');
        displayDate = 'yesterday';
    } else {
        startDate = resolveDateArg(date);
        displayDate = date;
    }

    // Use start_date and end_date to get entries for a specific day
    // The API expects ISO date strings (YYYY-MM-DD)
    params.start_date = format(startDate, 'yyyy-MM-dd');
    params.end_date = format(addDays(startDate, 1), 'yyyy-MM-dd');

    console.log('📝 [TOGGL]', `\x1b[32mGetting Entries for ${displayDate}\x1b[0m`)
    return toggleClient('/me/time_entries', {params});
}
