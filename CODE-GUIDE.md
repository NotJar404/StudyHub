# Study Hub: where to change what

## The pages (one file each)
| Page | File | What it holds |
|---|---|---|
| Home | `index.html` | hero, About, tools cards, **team cards**, contact |
| Class Scheduler | `schedule.html` + `scheduler.js` | upload, class list, wallpaper preview, customize tabs |
| Grade Calculator | `grades.html` + `script.js` ("GRADE CALCULATOR") | |
| Reviewer Deck | `deck.html` + `script.js` ("REVIEWER DECK") | |
| Truth Tables | `logic.html` + `script.js` ("TRUTH TABLES", "LOGIC GATES") | |
| Color Picker | `colors.html` + `script.js` ("COLOR PICKER") | |
| Number Converter | `convert.html` + `script.js` ("NUMBER CONVERTER") | |
| File Converter | `files.html` + `converter.js` | |

## Shared files
- `style.css`: all the colours, spacing and layout. Colours are at the very top ("DESIGN TOKENS").
- `script.js`: day/night button, menu, background, and the small tools.
- `lib.js`: helpers used by the scheduler and file converter (file reading, PDF, OCR, download).
- `api/scan.js`: the Gemini scan on the server. The key goes in Vercel as `GEMINI_API_KEY`, never in code.
- `vendor/`: third-party libraries. Do not edit.

## Common changes
- **Change a colour**: top of `style.css`, in the day block and the night block.
- **Add or edit a team member**: `index.html`, search `class="tm"`. Each member is one `<article>`.
- **Change the grade scale**: `script.js`, search `const SCALE`.
- **Change default weights**: `script.js`, search `['Activities', 15]` (the exam weight is in `grades.html`, `id="ex-w"`).
- **Truth table operator order**: `script.js`, search `const iff` (the parser checks the lowest priority, ↔, first and the highest, ¬, last).
- **Add a font to the wallpaper Text tab**: `scheduler.js`, search `const FONTS`.
- **Add a menu link**: the `<nav>` block is repeated in every `.html` file, so edit it in all of them.

## Tips
- The nav bar and footer are copied into each page, so a change there must be made in every `.html`.
- In `style.css`, a rule lower in the file beats an earlier one. If an edit seems to do nothing, search the class name again further down.
- After editing `style.css` or `script.js`, the `?v=7` in the `<link>`/`<script>` tags can be raised (for example to `?v=8`) so browsers load the new file instead of an old saved copy.
- Files were formatted with Prettier (settings in `.prettierrc.json`: 2 spaces, 100 characters per line). Run `npx prettier --write .` to tidy after edits.
