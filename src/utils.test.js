import {test, mock} from 'node:test';
import assert from 'node:assert';
import {format} from 'date-fns';
import {resolveDateArg} from './utils.js';

// 11:30pm Eastern on Sep 24 is already Sep 25 in UTC; run with TZ=America/New_York (npm test)
test('resolveDateArg uses the local day, not UTC', () => {
    mock.timers.enable({apis: ['Date'], now: new Date('2026-09-25T03:30:00Z')});
    const day = (arg) => format(resolveDateArg(arg), 'yyyy-MM-dd HH:mm');
    assert.equal(day('today'), '2026-09-24 00:00');
    assert.equal(day('yesterday'), '2026-09-23 00:00');
    assert.equal(day('2026-01-05'), '2026-01-05 00:00');
    assert.equal(day('9-7'), '2026-09-07 00:00');
    assert.throws(() => resolveDateArg('tomorrow'), /Unrecognized date/);
    mock.timers.reset();
});
