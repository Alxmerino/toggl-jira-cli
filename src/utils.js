import {format, subDays, startOfDay} from "date-fns";

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

// Resolves to local midnight so "today" follows the machine's timezone, not UTC
export function resolveDateArg(date) {
    const today = startOfDay(new Date());
    if (date === 'today') return today;
    if (date === 'yesterday') return subDays(today, 1);

    // YYYY-MM-DD, or MM-DD for the current year. Built from parts: new Date('YYYY-MM-DD') parses as UTC
    const parts = date.split('-').map(Number);
    const [year, month, day] = parts.length === 3 ? parts : [today.getFullYear(), ...parts];
    const resolved = new Date(year, month - 1, day);
    if (isNaN(resolved)) throw new Error(`Unrecognized date "${date}": use today, yesterday, YYYY-MM-DD or MM-DD`);
    return resolved;
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
        width: '15%'
    },
    {
        value: 'duration',
        alias: 'Decimal',
        align: 'left',
        color: 'yellow',
        width: '10%',
        formatter: function (value) {
            return decimalTime(roundDuration(value));
        }
    },
    {
        value: 'duration',
        alias: 'Time Worked',
        align: 'left',
        color: 'red',
        width: '20%',
        formatter: function (value) {
            return humanTime(roundDuration(value));
        }
    },
    {
        value: 'description',
        align: 'left',
        alias: 'Description',
        width: '55%',
        headerColor: 'white',
        color: 'white',
    }
]

export const footer = [
    'Total:',
    function (cellValue, columnIndex, rowIndex, rowData) {
        const total = rowData.reduce((prev, curr) => {
            return prev + curr[1]
        }, 0)

        return this.style(`${decimalTime(roundDuration(total))}`, "italic")
    },
    function (cellValue, columnIndex, rowIndex, rowData) {
        const total = rowData.reduce((prev, curr) => {
            return prev + curr[1]
        }, 0)

        return this.style(`${humanTime(roundDuration(total))}`, "italic")
    },
    ''
]
