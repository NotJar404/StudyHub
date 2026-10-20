// Vercel serverless function: keeps the Gemini API key on the server so visitors never see it.
// Set GEMINI_API_KEY in Vercel > Project Settings > Environment Variables (never in code).

const IMAGE_PROMPT = `You read a Philippine university Certificate of Registration (COR) or a weekly class schedule from a photo.
Return every class meeting as one item per day it meets.
- code: course code, uppercase (e.g. CC106). Keep it exactly as printed.
- subj: subject name in normal capitalisation.
- day: Monday, Tuesday, Wednesday, Thursday, Friday or Saturday. M=Monday, T=Tuesday, W=Wednesday, TH=Thursday, F=Friday, S=Saturday. Expand combined codes: MTH=Monday+Thursday, TTH=Tuesday+Thursday, WF=Wednesday+Friday, MWF=Monday+Wednesday+Friday, MTHF=Monday+Thursday+Friday, etc.
- type: "Lab" for laboratory sessions, otherwise "Lec". If the same code appears twice, the longer session is the Lab.
- units: number as printed, or "" if not shown.
- start, end: 24-hour "HH:MM" (1:00 PM becomes 13:00).
- room: as printed, or "".
Also return totalUnits if the document prints a total, else null.
Do not invent classes. If the image is not a COR or schedule, return an empty items list.`;

const TEXT_PROMPT = `Parse the following text from a COR (Certificate of Registration) document.
Return every class meeting as one item per day it meets.
- code: course code, uppercase (e.g. CC106). Keep it exactly as printed.
- subj: subject name in normal capitalisation.
- day: Monday, Tuesday, Wednesday, Thursday, Friday or Saturday. M=Monday, T=Tuesday, W=Wednesday, TH=Thursday, F=Friday, S=Saturday. Expand combined codes: MTH=Monday+Thursday, TTH=Tuesday+Thursday, WF=Wednesday+Friday, MWF=Monday+Wednesday+Friday, MTHF=Monday+Thursday+Friday, etc.
- type: "Lab" for laboratory sessions, otherwise "Lec". If the same code appears twice, the longer session is the Lab.
- units: number as printed, or "" if not shown.
- start, end: 24-hour "HH:MM" (1:00 PM becomes 13:00).
- room: as printed, or "".
Also return totalUnits if the document prints a total, else null.
Do not invent classes. If the text is not from a COR or schedule, return an empty items list.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    totalUnits: { type: 'NUMBER', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code: { type: 'STRING' }, subj: { type: 'STRING' },
          day: { type: 'STRING', enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
          type: { type: 'STRING', enum: ['Lec', 'Lab'] }, units: { type: 'STRING' },
          start: { type: 'STRING' }, end: { type: 'STRING' }, room: { type: 'STRING' }
        },
        required: ['code', 'subj', 'day', 'type', 'start', 'end']
      }
    }
  },
  required: ['items']
};

/** Return the thinkingConfig appropriate for a given model name. */
function thinkingConfigFor(model) {
  // 2.5-series: disable thinking entirely
  if (/^gemini-2\.5/.test(model)) return { thinkingBudget: 0 };
  // 3.x+ series: minimal thinking
  if (/^gemini-3\./.test(model)) return { thinkingLevel: 'minimal' };
  return undefined;
}

const STAGGER_MS = 8000;   // wait before launching the next model
const PER_MODEL_MS = 45000; // per-model timeout (Vercel limit is 60 s)
const MAX_MODELS = 3;
const FATAL_STATUSES = new Set([400, 403]);
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const MAX_BASE64_BYTES = 5_000_000;

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'Key not set' });

    // --- Parse body ---
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const { image, mime, text } = body || {};

    // Determine mode: text-based or image-based
    const useText = typeof text === 'string' && text.trim().length > 0;

    if (!useText) {
      // Image mode: validate image and mime
      if (typeof image !== 'string' || !/^image\/(jpeg|png|webp)$/.test(mime || ''))
        return res.status(400).json({ error: 'Send a JPEG, PNG or WebP image, or provide text' });
      if (image.length > MAX_BASE64_BYTES)
        return res.status(413).json({ error: 'Image too large (max ~5 MB base64)' });
    }

    // --- Build model list ---
    const models = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
      .filter((m, i, a) => m && a.indexOf(m) === i)
      .slice(0, MAX_MODELS);

    // --- Build per-model payload ---
    function buildPayload(model) {
      const thinking = thinkingConfigFor(model);
      const generationConfig = {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        ...(thinking ? { thinkingConfig: thinking } : {})
      };

      let parts;
      if (useText) {
        parts = [{ text: TEXT_PROMPT + '\n\n' + text.trim() }];
      } else {
        parts = [{ text: IMAGE_PROMPT }, { inlineData: { mimeType: mime, data: image } }];
      }

      return JSON.stringify({
        contents: [{ parts }],
        generationConfig
      });
    }

    // --- Staggered race ---
    const t0 = Date.now();
    const globalAbort = new AbortController();

    const ask = async (model) => {
      const payload = buildPayload(model);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: payload,
          signal: AbortSignal.any([globalAbort.signal, AbortSignal.timeout(PER_MODEL_MS)])
        }
      );

      if (!r.ok) {
        const detail = (await r.text()).slice(0, 500);
        console.error('Gemini error', r.status, 'model:', model, detail);
        const e = new Error('Gemini error ' + r.status);
        e.status = r.status;
        e.detail = detail;
        e.fatal = FATAL_STATUSES.has(r.status);
        throw e;
      }

      const j = await r.json();
      const resultText = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      const parsed = JSON.parse(resultText);
      console.log('scan ok — model:', model, 'time:', Date.now() - t0, 'ms');
      return parsed;
    };

    const result = await new Promise((resolve) => {
      let next = 0, running = 0, done = false;
      let last = { status: 0, detail: '' };
      let staggerTimer;

      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(staggerTimer);
        globalAbort.abort();
        resolve(v);
      };

      const launch = () => {
        if (done) return;
        clearTimeout(staggerTimer);
        if (next >= models.length) {
          if (!running) finish({ error: last });
          return;
        }
        const model = models[next++];
        running++;
        // Schedule next model launch after STAGGER_MS (if there are more models)
        if (next < models.length) {
          staggerTimer = setTimeout(launch, STAGGER_MS);
        }
        ask(model).then(
          (json) => finish({ json, model }),
          (e) => {
            running--;
            last = {
              status: e.status || 0,
              detail: e.detail || (e.name === 'TimeoutError' ? 'Gemini took too long to answer' : String(e.message || e))
            };
            if (e.fatal) return finish({ error: last });
            launch(); // retryable: try next model immediately
          }
        );
      };

      launch();
    });

    if (result.json) return res.status(200).json(result.json);
    return res.status(502).json({ error: 'Gemini error ' + result.error.status, detail: result.error.detail });
  } catch (err) {
    console.error('scan.js uncaught:', err);
    return res.status(500).json({ error: 'Internal error', detail: String(err.message || err) });
  }
};
