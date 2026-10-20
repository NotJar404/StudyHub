// Vercel serverless function: keeps the Gemini API key on the server so visitors never see it.
// Set GEMINI_API_KEY in Vercel > Project Settings > Environment Variables (never in code).

const PROMPT = `You read a Philippine university Certificate of Registration (COR) or a weekly class schedule from a photo.
Return every class meeting as one item per day it meets.
- code: course code, uppercase (e.g. CC106). Keep it exactly as printed.
- subj: subject name in normal capitalisation.
- day: Monday, Tuesday, Wednesday, Thursday, Friday or Saturday. M=Monday, T=Tuesday, W=Wednesday, TH=Thursday, F=Friday, S=Saturday. A row like "MTH" or "TTH" means one item per day.
- type: "Lab" for laboratory sessions, otherwise "Lec". If the same code appears twice, the longer session is the Lab.
- units: number as printed, or "" if not shown.
- start, end: 24-hour "HH:MM" (1:00 PM becomes 13:00).
- room: as printed, or "".
Also return totalUnits if the document prints a total, else null.
Do not invent classes. If the image is not a COR or schedule, return an empty items list.`;

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Key not set' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const { image, mime } = body || {};
  if (typeof image !== 'string' || !/^image\/(jpeg|png|webp)$/.test(mime || '')) return res.status(400).json({ error: 'Send a JPEG, PNG or WebP image' });
  if (image.length > 4000000) return res.status(413).json({ error: 'Image too large' });

  // Speed + reliability: start with the fastest model; if it has not answered in 7 s (or fails), start the next one
  // alongside it. The first good answer wins and the rest are cancelled.
  const models = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash']
    .filter((m, i, a) => m && a.indexOf(m) === i).slice(0, 3);
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: image } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
  });
  const RETRY = [404, 429, 500, 503, 504];

  const t0 = Date.now();
  const all = new AbortController();
  const ask = async (model) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: payload,
      signal: AbortSignal.any([all.signal, AbortSignal.timeout(40000)])
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      console.error('Gemini error', r.status, 'model:', model, detail); // shows up in Vercel > Logs
      const e = new Error('Gemini error ' + r.status); e.status = r.status; e.detail = detail; e.fatal = !RETRY.includes(r.status);
      throw e;
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return JSON.parse(text);
  };

  const result = await new Promise((resolve) => {
    let next = 0, running = 0, done = false, last = { status: 0, detail: '' }, timer;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); all.abort(); resolve(v); };
    const launch = () => {
      if (done) return;
      clearTimeout(timer);
      if (next >= models.length) { if (!running) finish({ error: last }); return; }
      const model = models[next++];
      running++;
      timer = setTimeout(launch, 7000); // slow? bring in the next model
      ask(model).then(
        (json) => finish({ json }),
        (e) => {
          running--;
          last = { status: e.status || 0, detail: e.detail || (e.name === 'TimeoutError' ? 'Gemini took too long to answer' : String(e.message || e)) };
          if (e.fatal) return finish({ error: last }); // bad key / bad request: another model will not help
          launch();
        }
      );
    };
    launch();
  });

  console.log('scan done in', Date.now() - t0, 'ms', result.json ? 'ok' : 'failed');
  if (result.json) return res.status(200).json(result.json);
  return res.status(502).json({ error: 'Gemini error ' + result.error.status, detail: result.error.detail });
};