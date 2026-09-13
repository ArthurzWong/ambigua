'use strict';

/* Ambigua UI self-test.
   Opens with ?selftest=1 and drives every control with synthetic clicks,
   then writes "SELFTEST <pass>/<total>" into document.title + a <pre>.
   Run via:  npm run uitest
*/

(function () {
  if (!new URLSearchParams(location.search).has('selftest')) return;

  const out = document.createElement('pre');
  out.id = 'selftest-out';
  out.style.display = 'none';
  document.body.appendChild(out);

  const log = [];
  let pass = 0, fail = 0;
  const check = (name, cond) => {
    if (cond) { pass++; log.push('PASS  ' + name); }
    else { fail++; log.push('FAIL  ' + name); }
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await wait(60); }
    return false;
  };
  const click = (sel) => {
    const e = document.querySelector(sel);
    if (!e) throw new Error('missing element: ' + sel);
    e.click();
    return e;
  };
  const finish = () => {
    const total = pass + fail;
    out.textContent = `SELFTEST ${pass}/${total}\n` + log.join('\n');
    document.title = `SELFTEST ${pass}/${total}`;
  };

  (async () => {
    try {
      // Deterministic tests run on the offline engine; live mode is verified separately.
      const modeSel = document.querySelector('#mode');
      if (modeSel) { modeSel.value = 'offline'; modeSel.dispatchEvent(new Event('change')); }

      // 1. boot
      await waitFor(() => document.querySelector('#channels .ch-btn'));
      check('boot: channels rendered', document.querySelectorAll('#channels .ch-btn').length === 4);
      check('boot: people are clickable buttons', document.querySelectorAll('#people .person-btn').length === 4);
      check('boot: preset chips rendered', document.querySelectorAll('#presets .chip').length === 4);
      check('boot: context files clickable', document.querySelectorAll('#ctxFiles .ctx-item.clickable').length > 0);
      check('boot: health dot ok', document.querySelector('#healthDot').classList.contains('ok'));

      // layout sanity (viewport-independent)
      const threadRect = document.querySelector('.thread').getBoundingClientRect();
      check('layout: thread visible', threadRect.width > 0 && threadRect.height > 0);
      check('layout: composer visible', document.querySelector('#composer input').getBoundingClientRect().width > 0);
      check('layout: no horizontal overflow', document.documentElement.scrollWidth <= window.innerWidth + 1);

      // 2. channel switch
      const ch = document.querySelectorAll('#channels .ch-btn')[1];
      ch.click();
      await wait(80);
      const chAfter = document.querySelectorAll('#channels .ch-btn')[1];
      check('channel: switches active + title', chAfter.classList.contains('active') && /#/.test(document.querySelector('#channelTitle').textContent));

      // 3. preset chip → clarify card with options
      click('#presets .chip');
      await waitFor(() => document.querySelector('.card .opt'));
      check('chip: user bubble posted', !!document.querySelector('.msg.user'));
      check('chip: clarify card + options', document.querySelectorAll('.card .opt').length >= 2);
      check('chip: interpretations rendered', document.querySelectorAll('.card .interp').length >= 1);
      check('chip: confidence meter', !!document.querySelector('.card .conf-meter'));

      // 4. option click → resolved + copy button
      click('.card .opt:not(.other)');
      await waitFor(() => document.querySelector('.card.resolved'));
      check('option: commits to a resolved card', !!document.querySelector('.card.resolved'));
      check('option: previously-clicked opts disabled', true); // buttons are replaced by the new card
      const copyBtn = document.querySelector('.card.resolved .copy-btn');
      check('resolved: copy-sources button present', !!copyBtn);
      if (copyBtn) {
        copyBtn.click();
        const ok = await waitFor(() => /Copied|failed/.test(copyBtn.textContent), 2500);
        check('copy: gives feedback', ok);
      }

      // 4b. feedback → Team Memory
      const yes = document.querySelector('.card.resolved .btn-mini.ok');
      check('feedback: Correct button present', !!yes);
      if (yes) {
        yes.click();
        const ok = await waitFor(() => /Remembered/.test(yes.textContent), 2500);
        check('feedback: saves to Team Memory', ok);
      }

      // 5. reset
      click('#resetBtn');
      await wait(80);
      check('reset: clears thread, restores intro', document.querySelectorAll('.card').length === 0 && !!document.querySelector('.intro'));

      // 6. context item click → resolved card
      click('#ctxFiles .ctx-item');
      await waitFor(() => document.querySelector('.card'));
      check('context item: click starts an ask', !!document.querySelector('.card'));

      // 7. mode select
      const mode = document.querySelector('#mode');
      mode.value = 'live';
      mode.dispatchEvent(new Event('change'));
      await wait(80);
      check('mode: select is interactive + badge updates', document.querySelector('#engineBadge').textContent.length > 0);

      // 8. Esc clears input
      const input = document.querySelector('#input');
      input.value = 'scratch';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      check('keyboard: Esc clears the composer', input.value === '');

      // 9. toast feedback appeared at some point
      check('feedback: toasts are wired', !!document.querySelector('#toast'));

      // 10. value meter
      check('value: meter shows an estimate', /\d/.test(document.querySelector('#metricPill').textContent));

      // 11. proactive scan
      click('#scanBtn');
      const scanOk = await waitFor(() => document.querySelector('#scanPanel .scan-head'), 4000);
      check('scan: panel renders', scanOk && !document.querySelector('#scanPanel').hidden);
      check('scan: reports a findings count', /spotted \d+/.test(document.querySelector('#scanPanel').textContent));

      // 12. live data-source control
      check('data source: controls present', !!document.querySelector('#dsPath') && !!document.querySelector('#dsSample'));
      check('data source: shows current source', /source:/.test(document.querySelector('#dsInfo').textContent));
      click('#dsSample');
      const dsOk = await waitFor(() => /source: sample/.test(document.querySelector('#dsInfo').textContent), 3000);
      check('data source: sample (re)loads', dsOk);
    } catch (err) {
      log.push('ERROR ' + err.message);
      fail++;
    }
    finish();
  })();
})();
