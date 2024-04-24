import {getQueryParams} from './utils.js';

const {JIRA_USER, JIRA_PASSWORD, JIRA_API_URL} = process.env

const jiraClient = async (url = '/', settings = {}) => {
    let METHOD = 'GET';
    let body = {};
    let URL = JIRA_API_URL + url;
    if ('params' in settings) {
        const {params} = settings;
        URL = URL + '?' + getQueryParams(params);
    }

    if ('body' in settings) {
        METHOD = 'POST';
        body = settings.body
    }

    console.log(`🌐 [JIRA]  ${METHOD === 'POST' ? 'Posting' : 'Fetching'}:`, `\x1b[32m${URL}\x1b[0m`)

    return fetch(URL, {
        method: METHOD,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            "Content-Type": "application/json",
            'Authorization': 'Basic ' + btoa(JIRA_USER + ':' + JIRA_PASSWORD)
        }
    })
        .then(response => {
            if (!response.ok) {
                console.log('🫠', {
                    status: response.status,
                    statusText: response.statusText,
                    body: response.body,
                })
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .catch(error => {
            console.error('🫠 There was a problem with the fetch operation:', error);
        });
}

export const postIssueWorklog = async (issueKey, body) => {
    return jiraClient(`/issue/${issueKey}/worklog`, {
        body
    })
}
