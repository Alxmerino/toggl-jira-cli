import {addDays, format, parseISO, startOfDay, subDays} from "date-fns";

export function humanTime(seconds) {
    const levels = [
        [Math.floor((seconds % 31536000) / 86400), 'days'],
        [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
        [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'mins'],
        [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
    ];
    let returnText = '';

    for (let i = 0, max = levels.length; i < max; i++) {
        if (levels[i][0] === 0) continue;
        returnText += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substring(0, levels[i][1].length - 1) : levels[i][1]);
    }
    ;
    return returnText.trim();
}

export function decimalTime(seconds) {
    const hours = seconds / 3600;
    return hours.toFixed(2);
}

// Everhour dates a time record by calendar day: 2026-09-02
export function toApiDate(date) {
    return format(date, 'yyyy-MM-dd');
}

export function roundDuration(durationInSeconds, nearestMinutes = 5) {
    // Convert duration from seconds to minutes
    const durationInMinutes = durationInSeconds / 60;

    // Round duration to the nearest multiple of 5
    const roundedDurationInMinutes = Math.round(durationInMinutes / nearestMinutes) * nearestMinutes;

    // Convert rounded duration back to seconds
    return roundedDurationInMinutes * 60;
}

export const midnightUnix = (date) => {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

export const logError = (response) => {
    console.log('🫠 \x1b[31mThere was an error: \x1b[0m', {
        status: response.status,
        code: response.code,
        text: response.statusText
    })
}

export const getQueryParams = (params) => {
    return Object.keys(params)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        // .map(key => key + '=' + params[key])
        .join('&');
}

// Resolves to local midnight so "today" follows the machine's timezone, not UTC
export function resolveDateArg(date) {
    const today = startOfDay(new Date());
    if (date === 'today') return today;
    if (date === 'yesterday') return subDays(today, 1);

    // YYYY-MM-DD, or MM-DD for the current year. Built from parts: new Date('YYYY-MM-DD') parses as UTC
    const parts = date.split('-').map(Number);
    const [year, month, day] = parts.length === 3 ? parts : [today.getFullYear(), ...parts];
    const resolved = new Date(year, month - 1, day);
    // The Date constructor rolls 02-31 over into March; reject instead
    if (isNaN(resolved) || resolved.getMonth() !== month - 1 || resolved.getDate() !== day) {
        throw new Error(`Invalid date "${date}": use today, yesterday, YYYY-MM-DD or MM-DD`);
    }
    return resolved;
}

// Local-day window as offset-aware RFC3339, so Toggl slices on the same day the user sees.
export function localDayRange(date) {
    const start = resolveDateArg(date);
    return {
        start_date: format(start, "yyyy-MM-dd'T'HH:mm:ssxxx"),
        end_date: format(addDays(start, 1), "yyyy-MM-dd'T'HH:mm:ssxxx")
    };
}

// Two instants land on the same day only from the user's local point of view.
export function isSameLocalDay(isoString, date) {
    return format(parseISO(isoString), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
}

export function humanReadableDate(date) {
    return format(date, 'PP');
}

export const header = [
    // {
    //     value: 'project_name',
    //     alias: 'Project',
    //     headerColor: 'cyan',
    //     color: 'white',
    //     align: 'left',
    //     width: '15%'
    // },
    {
        value: 'tag',
        alias: 'Issue',
        headerColor: 'cyan',
        color: 'white',
        align: 'left',
        width: '13%'
    },
    {
        value: 'started',
        alias: 'Started',
        headerColor: 'cyan',
        color: 'white',
        align: 'left',
        width: '16%',
        formatter: function (value) {
            return format(parseISO(value), 'MMM d, h:mm a');
        }
    },
    {
        value: 'description',
        align: 'left',
        alias: 'Description',
        width: '39%',
        headerColor: 'white',
        color: 'white',
    },
    {
        value: 'duration',
        alias: 'Time Worked',
        align: 'left',
        color: 'red',
        width: '17%',
        formatter: function (value) {
            return humanTime(roundDuration(value));
        }
    },
    {
        value: 'alreadyLogged',
        alias: 'In Everhour',
        align: 'left',
        headerColor: 'cyan',
        width: '17%',
        formatter: function (value) {
            return value > 0 ? humanTime(value) : '—';
        }
    }
]

export const footer = [
    'Total',
    '',
    '',
    // Column 3 is "Time Worked"; the trailing '' keeps "In Everhour" blank.
    function (cellValue, columnIndex, rowIndex, rowData) {
        const total = rowData.reduce((prev, curr) => {
            return prev + curr[3]
        }, 0)

        return this.style(`${humanTime(roundDuration(total))}`, "italic")
    },
    ''
]
