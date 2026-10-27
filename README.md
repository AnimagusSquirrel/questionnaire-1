# Questionnaire

A slideshow-style questionnaire. One card per question, arrow keys or buttons to move, an insight box that
updates with the answer, and per-question time tracking. Plain HTML, CSS and JS: no build step, so it works as-is on GitHub Pages.

## Run it locally

```bash
node server.js
```

Open http://localhost:5173. The same server saves responses to `data/<sessionId>.json`.

Useful URL flags:

| Flag | Effect |
| --- | --- |
| `?reset` | Forget the saved session in this browser and start again |
| `?debug` | Show a live per-slide timer in the corner |

Progress is kept in `localStorage`, so a refresh resumes where you were.

## Files

| File | What it is |
| --- | --- |
| `js/questions.js` | **The questions.** Add, remove or reorder slides here |
| `js/config.js` | Endpoint for responses, benchmark switch |
| `js/illustration.js` | Draws the placeholder character; swaps in your own art |
| `js/app.js` | Slide engine, navigation, time tracking, submission |
| `css/style.css` | Colour tokens at the top (`:root`), then components |
| `server.js` | Local-only server that stores responses |

## Question types

`choice`, `multi` (set `max`), `group` (several rows on one card), `slider`, `likert`, `text`, plus `intro` and `outro`.
A slide can be skipped with `showIf: (answers) => ...` (the "age you first felt middle-aged" slide only shows after a Yes).
Question numbers update automatically.

## Your illustrations

Every slide has a square picture slot. Until you provide art it draws a placeholder character. To use your own, put a file
in `illustrations/` and point the slide at it:

```js
{ id: 'defined', type: 'multi', art: 'illustrations/defined.svg', ... }
```

Square SVG or PNG works best. The label on the corner of the picture is the slide's `tag` (can be a function of the answers).

## What gets recorded

Per session, sent on every slide change, when the tab is hidden or closed (so drop-outs are kept), and at the end:

```json
{
  "sessionId": "…", "startedAt": "…", "updatedAt": "…", "complete": true,
  "answers": { "decadeNow": "30s", "defined": ["work", "relationships"], "control": 4 },
  "order":   ["intro", "decades", "defined", "…"],
  "timings": {
    "defined": { "totalMs": 18800, "visits": 1, "firstAnswerMs": 18300, "lastAnswerMs": 18800, "changes": 1 }
  }
}
```

- `totalMs`: time the slide was on screen **and the tab was visible**, summed over all visits.
- `firstAnswerMs`: how long until they first answered. `changes`: how many times they re-answered.
- Several snapshots arrive per session; keep the latest one per `sessionId` (the local server overwrites the file).

## Hosting on GitHub Pages

GitHub Pages only serves static files, so it cannot store responses by itself. Set `ENDPOINT` in `js/config.js`
to any URL that accepts a POST. The easiest free option is a Google Apps Script web app bound to a Google Sheet:

```js
function doPost(e) {
  const r = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('responses') || ss.insertSheet('responses');
  const ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().flat();
  let row = ids.indexOf(r.sessionId) + 1;
  if (!row) row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 5).setValues([[r.sessionId, r.updatedAt, r.complete, JSON.stringify(r.answers), JSON.stringify(r.timings)]]);
  return ContentService.createTextOutput('{"ok":true}').setMimeType(ContentService.MimeType.JSON);
}
```

Deploy it as a web app (execute as you, access: anyone) and paste the `/exec` URL into `ENDPOINT`.
Supabase or Firebase work too; the payload is plain JSON.

Then, in the repo settings, enable Pages from the `main` branch root.

## Placeholder numbers

The percentages in the insight boxes ("29% of readers said the same") are **made-up placeholders** in `BENCH` at the top of
`js/questions.js`. Replace them with real data, or set `SHOW_BENCHMARKS: false` in `js/config.js` to hide them.
