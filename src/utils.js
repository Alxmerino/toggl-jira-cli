import { UTCDate } from "@date-fns/utc";
import {format, subDays} from "date-fns";

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

export function formatTime(timeString) {
    return timeString.split('+')[0];
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
    // Get current date
    const currentDate = date ?? new Date();

    // Set time to midnight
    currentDate.setHours(0, 0, 0, 0);

    // Get timestamp in seconds
    return Math.floor(currentDate.getTime() / 1000);
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

export function resolveDateArg(date) {
    let resolvedDate = new UTCDate();

    switch (date) {
        case 'today':
            break;
        case 'yesterday':
            resolvedDate = subDays(resolvedDate, 1);
            break;
        default:
            // YYYY-MM-DD
            const year = resolvedDate.getFullYear();
            resolvedDate = new UTCDate(year + '-' + date);
            break
    }

    resolvedDate.setHours(0);
    resolvedDate.setMinutes(0);
    resolvedDate.setSeconds(0);

    return resolvedDate;
}

export function humanReadableDate(date) {
    return format(date, 'PP');
}

export const header = [
    {
        value: 'project_name',
        alias: 'Issue',
        headerColor: 'cyan',
        color: 'white',
        align: 'left',
        width: '15%'
    },
    {
        value: 'description',
        align: 'left',
        alias: 'Description',
        width: '60%',
        headerColor: 'white',
        color: 'white',
    },
    {
        value: 'duration',
        alias: 'Time Worked',
        align: 'left',
        color: 'red',
        width: '25%',
        formatter: function (value) {
            return humanTime(roundDuration(value));
        }
    }
]

export const footer = [
    'Total',
    '',
    function (cellValue, columnIndex, rowIndex, rowData) {
        const total = rowData.reduce((prev, curr) => {
            return prev + curr[2]
        }, 0)

        return this.style(`${humanTime(roundDuration(total))}`, "italic")
    }
]
