import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('../../src/components/shared/VetPresenceDisplay.jsx', import.meta.url), 'utf8');
const transformed = await transformWithOxc(source, 'VetPresenceDisplay.jsx', { jsx: { runtime: 'automatic' } });
// Native imports keep React and icons identical to those used by this renderer.
const executable = transformed.code.replace(/from (["'])([^"']+)\1/g, (_match, _quote, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { default: Display } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`);
let checked = 0;
for (const variant of ['home', 'landing']) {
    for (const [presence, error, homeText, landingText] of [
        [{ isIn: true }, false, 'The vet is in', 'THE VET IS IN'],
        [{ isIn: false }, false, 'The vet is currently out', 'THE VET IS OUT'],
        [{ isIn: false, adminIsIn: true, status: 'closed', clinic: { isOpen: false, name: 'Main Clinic' } }, false, 'Clinic is closed', 'CLINIC IS CLOSED'],
        [{ isIn: true, clinic: { isOpen: false } }, false, 'Clinic is closed', 'CLINIC IS CLOSED'],
        [{ isIn: false, adminIsIn: true, status: 'lunch', clinic: { isOpen: true } }, false, 'Vet appointments on lunch break', 'VET LUNCH BREAK'],
        [null, false, 'Checking on the vet', 'CHECKING VET STATUS'],
        [{ isIn: true }, true, 'Status temporarily unavailable', 'VET STATUS UNAVAILABLE'],
    ]) {
        const expected = variant === 'landing' ? landingText : homeText;
        const html = renderToStaticMarkup(createElement(Display, { variant, presence, error, scheduleHref: '#test-calendar' }));
        assert.ok(html.includes(expected));
        assert.ok(html.includes('role="status"'));
        assert.ok(html.includes('aria-atomic="true"'));
        if (variant === 'landing') {
            for (const removed of ['Manila', 'Lunch break', 'Today at the clinic', 'View appointment times', 'href="#test-calendar"']) assert.ok(!html.includes(removed), `Landing omits ${removed}`);
            assert.ok(html.includes('bg-white'), 'Landing sign uses a white background');
        } else {
            assert.ok(html.includes('Manila'));
            assert.ok(html.includes('Grooming remains bookable'));
        }
        assert.ok(!html.includes('role="switch"'), 'Public signs never expose the admin switch');
        if (presence?.status === 'closed' || presence?.clinic?.isOpen === false || presence?.status === 'lunch') {
            assert.ok(!html.includes('The vet is in') && !html.includes('THE VET IS IN'), 'Closed and lunch signs never claim the vet is in');
        }
        if (error) {
            assert.ok(html.includes(variant === 'landing' ? 'Retry vet status' : 'Retry status'));
            assert.ok(!html.includes('The vet is in') && !html.includes('THE VET IS IN'), 'Failed refresh does not claim the vet is in');
        } else if (variant === 'home') {
            assert.ok(html.includes('href="#test-calendar"'));
        }
        console.log(`PASS: ${variant} / ${expected}`);
        checked++;
    }
}
console.log(`${checked} public display states passed.`);
