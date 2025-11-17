import {getUnixTime, subDays, setHours, startOfYesterday, endOfYesterday} from "date-fns";
import {midnightUnix, getQueryParams, logError, resolveDateArg} from './utils.js';

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

    if (date === 'today') {
        params.since = midnightUnix();
        displayDate = 'today';
    } else if (date === 'yesterday') {
        params.since = midnightUnix(subDays(new Date(), 1));
        displayDate = 'yesterday';
    } else {
        const resolveDate = resolveDateArg(date);
        params.since = midnightUnix(resolveDate);
        displayDate = date;
    }

    console.log('📝 [TOGGL]', `\x1b[32mGetting Entries for ${displayDate}\x1b[0m`)
    return toggleClient('/me/time_entries', {params});
}
