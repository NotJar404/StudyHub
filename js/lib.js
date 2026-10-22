// ===== SHARED HELPERS FOR THE SCHEDULER AND THE FILE CONVERTER =====
// Loads the heavy libraries only when a tool needs them, so the other pages stay fast.
const Lib = (() => {
  const loaded = {};
  // Try each address in order until one loads (a backup address keeps tools working if one is blocked).
  const script = (urls, test) => {
    if (test && test()) return Promise.resolve();
    const key = urls.join('|');
    if (loaded[key]) return loaded[key];
    return (loaded[key] = new Promise((ok, no) => {
      let i = 0;
      const next = () => {
        if (i >= urls.length) {
          delete loaded[key];
          return no(new Error('Could not load a helper library. Check your internet connection.'));
        }
        const s = document.createElement('script');
        s.src = urls[i++];
        s.async = true;
        s.onload = () => (!test || test() ? ok() : next());
        s.onerror = () => {
          s.remove();
          next();
        };
        document.head.appendChild(s);
      };
      next();
    }));
  };

  const jszip = () =>
    script(
      ['js/vendor/jszip.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'],
      () => window.JSZip
    );

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const pdfjs = async () => {
    await script(
      [PDFJS + 'pdf.min.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],
      () => window.pdfjsLib
    );
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc)
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    return pdfjsLib;
  };
  const openPdf = async file => {
    const lib = await pdfjs();
    return lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  };
  const pdfPageToCanvas = async (pdf, n, width) => {
    const page = await pdf.getPage(n),
      v1 = page.getViewport({ scale: 1 }),
      k = width / v1.width,
      vp = page.getViewport({ scale: k });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, canvas: c, viewport: vp }).promise;
    return c;
  };

  // Photo or first PDF page -> canvas, no larger than `max` pixels on its long side.
  const fileToCanvas = async (file, max) => {
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      const pdf = await openPdf(file);
      return pdfPageToCanvas(pdf, 1, Math.min(max, 2400));
    }
    // Read the file with the FileReader API, then decode it as an image (the browser applies the photo's rotation).
    const readDataUrl = f =>
      new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => no(r.error);
        r.readAsDataURL(f);
      });
    let src, w, h;
    try {
      const url = await readDataUrl(file);
      src = await new Promise((ok, no) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = no;
        im.src = url;
      });
      w = src.naturalWidth;
      h = src.naturalHeight;
    } catch (e) {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w = src.width;
      h = src.height;
    }
    const k = Math.min(1, max / Math.max(w, h)),
      c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };

  // ----- Make a photo easier for the text reader -----
  // 1) straighten a tilted photo  2) right size  3) grey + contrast  4) erase table lines  5) optional black-and-white
  // mode 'gray' keeps soft greys. 'bw' also removes shadows with a local threshold ('bwl' = bolder text, 'bws' = sharpened first).
  const localThreshold = (gray, W, H, r, k) => {
    const w1 = W + 1,
      I = new Float64Array(w1 * (H + 1)),
      out = new Uint8Array(W * H); // out: 1 = ink
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) {
        row += gray[y * W + x];
        I[(y + 1) * w1 + x + 1] = I[y * w1 + x + 1] + row;
      }
    }
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r),
        y1 = Math.min(H, y + r + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r),
          x1 = Math.min(W, x + r + 1);
        const mean =
          (I[y1 * w1 + x1] - I[y0 * w1 + x1] - I[y1 * w1 + x0] + I[y0 * w1 + x0]) /
          ((x1 - x0) * (y1 - y0));
        out[y * W + x] = gray[y * W + x] < mean * k ? 1 : 0;
      }
    }
    return out;
  };
  // how many degrees is the page tilted? (lines of text and table rules line up when it is straight)
  const skewAngle = src => {
    const k = Math.min(1, 900 / Math.max(src.width, src.height)),
      w = Math.round(src.width * k),
      h = Math.round(src.height * k);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data,
      gr = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++)
      gr[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const ink = localThreshold(gr, w, h, Math.max(8, Math.round(w / 30)), 0.82),
      pts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) pts.push(x, y);
    if (pts.length < 200) return 0;
    const step = pts.length / 2 > 60000 ? Math.ceil(pts.length / 2 / 60000) : 1;
    const score = deg => {
      const t = (deg * Math.PI) / 180,
        s = Math.sin(t),
        co = Math.cos(t),
        bins = new Float64Array(h * 2 + 4);
      for (let i = 0; i < pts.length; i += 2 * step) {
        const yy = Math.round(pts[i + 1] * co - pts[i] * s + h);
        if (yy >= 0 && yy < bins.length) bins[yy]++;
      }
      let sc = 0;
      for (let i = 0; i < bins.length; i++) sc += bins[i] * bins[i];
      return sc;
    };
    let best = 0,
      bs = score(0);
    for (let a = -8; a <= 8; a += 0.5) {
      const v = score(a);
      if (v > bs) {
        bs = v;
        best = a;
      }
    }
    for (let a = best - 0.5; a <= best + 0.5; a += 0.1) {
      const v = score(a);
      if (v > bs) {
        bs = v;
        best = a;
      }
    }
    return Math.abs(best) < 0.25 ? 0 : best;
  };
  const prep = (src, mode) => {
    const ang = skewAngle(src);
    const long = Math.max(src.width, src.height),
      k = long < 2200 ? 2200 / long : long > 3200 ? 3200 / long : 1;
    let W = Math.round(src.width * k),
      H = Math.round(src.height * k);
    const c = document.createElement('canvas'),
      g0 = c.getContext('2d', { willReadFrequently: true });
    if (ang) {
      const t = (ang * Math.PI) / 180,
        w0 = W,
        h0 = H;
      W = Math.round(Math.abs(w0 * Math.cos(t)) + Math.abs(h0 * Math.sin(t)));
      H = Math.round(Math.abs(h0 * Math.cos(t)) + Math.abs(w0 * Math.sin(t)));
      c.width = W;
      c.height = H;
      g0.fillStyle = '#fff';
      g0.fillRect(0, 0, W, H);
      g0.imageSmoothingQuality = 'high';
      g0.translate(W / 2, H / 2);
      g0.rotate(-t);
      g0.drawImage(src, (-src.width * k) / 2, (-src.height * k) / 2, src.width * k, src.height * k);
    } else {
      c.width = W;
      c.height = H;
      g0.imageSmoothingQuality = 'high';
      g0.drawImage(src, 0, 0, W, H);
    }
    const img = g0.getImageData(0, 0, W, H),
      d = img.data,
      n = W * H,
      gray = new Uint8ClampedArray(n),
      hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      gray[j] = v;
      hist[v]++;
    }
    let lo = 0,
      hi = 255,
      acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= n * 0.01) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= n * 0.01) {
        hi = v;
        break;
      }
    }
    if (hi - lo < 30) {
      lo = 0;
      hi = 255;
    }
    const sc = 255 / (hi - lo);
    for (let j = 0; j < n; j++) {
      const v = (gray[j] - lo) * sc;
      gray[j] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    if (mode === 'bws') {
      // unsharp mask for blurry photos
      const bl = new Uint8ClampedArray(gray);
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          bl[i] =
            (gray[i - W - 1] +
              gray[i - W] +
              gray[i - W + 1] +
              gray[i - 1] +
              gray[i] +
              gray[i + 1] +
              gray[i + W - 1] +
              gray[i + W] +
              gray[i + W + 1]) /
            9;
        }
      for (let j = 0; j < n; j++) {
        const v = gray[j] + 1.6 * (gray[j] - bl[j]);
        gray[j] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    const ink = localThreshold(
      gray,
      W,
      H,
      Math.max(15, Math.round(W / 40)),
      mode === 'bwl' ? 0.93 : mode === 'bws' ? 0.9 : 0.86
    );
    // erase long straight rules (table borders) so they are not read as letters
    const minH = Math.round(W / 16),
      minV = Math.round(W / 14),
      erase = new Uint8Array(n);
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!ink[y * W + x]) {
          x++;
          continue;
        }
        let e = x;
        while (e < W && ink[y * W + e]) e++;
        if (e - x >= minH) for (let q = x; q < e; q++) erase[y * W + q] = 1;
        x = e;
      }
    }
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        if (!ink[y * W + x]) {
          y++;
          continue;
        }
        let e = y;
        while (e < H && ink[e * W + x]) e++;
        if (e - y >= minV) for (let q = y; q < e; q++) erase[q * W + x] = 1;
        y = e;
      }
    }
    // thicken the erased area a little so no thin edge is left behind
    const er2 = new Uint8Array(erase);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!erase[i] && (erase[i - 1] || erase[i + 1] || erase[i - W] || erase[i + W]) && ink[i])
          er2[i] = 1;
      }
    for (let j = 0; j < n; j++) {
      if (er2[j]) gray[j] = 255;
      else if (mode !== 'gray') gray[j] = ink[j] ? 0 : 255;
    }
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      d[i] = d[i + 1] = d[i + 2] = gray[j];
      d[i + 3] = 255;
    }
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.putImageData(img, 0, 0);
    return c;
  };

  // ----- Text reader (Tesseract, runs in the browser) -----
  const TESS = [
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js'
  ];
  const LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';
  let worker = null,
    hold = { cb: null };
  const getWorker = async () => {
    await script(TESS, () => window.Tesseract);
    if (worker) return worker;
    const logger = m => {
      hold.cb && hold.cb(m);
    };
    // try the main address first, then a backup address, then the library's own defaults
    const tries = [
      { logger, langPath: LANG },
      {
        logger,
        langPath: 'https://unpkg.com/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
        workerPath: 'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js',
        corePath: 'https://unpkg.com/tesseract.js-core@5.1.0'
      },
      { logger }
    ];
    let last;
    for (const o of tries) {
      try {
        worker = await Tesseract.createWorker('eng', 1, o);
        return worker;
      } catch (e) {
        last = e;
      }
    }
    throw last;
  };
  // psm 6 = one block of text (good for tables), psm 4 = columns of varying size
  // Turns whatever the reader returns into plain lists of words and lines with their positions.
  const shape = d => {
    const W = w => ({
      t: String(w.text || '').trim(),
      c: w.confidence == null ? null : w.confidence,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1
    });
    let lines = d.lines;
    if (!lines && d.blocks) {
      lines = [];
      d.blocks.forEach(b =>
        (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push(l)))
      );
    }
    let words = d.words;
    if (!words && lines) {
      words = [];
      lines.forEach(l => (l.words || []).forEach(w => words.push(w)));
    }
    const out = { text: d.text || '', words: null, lines: null };
    try {
      if (words) out.words = words.filter(w => w && w.bbox).map(W);
      if (lines)
        out.lines = lines
          .filter(l => l && l.bbox)
          .map(l => ({
            t: String(l.text || '')
              .replace(/\s+/g, ' ')
              .trim(),
            words: (l.words || []).filter(w => w && w.bbox).map(W)
          }));
    } catch (e) {
      out.words = out.lines = null;
    }
    return out;
  };
  // psm 6 = one block of text (good for tables), 7 = a single line, 11 = scattered words.
  // full:true also returns where each word is. whitelist limits which characters can be read.
  const ocr = async (canvas, { psm = 6, onProgress, whitelist = '', full = false } = {}) => {
    const w = await getWorker();
    hold.cb = m => {
      if (onProgress && m && m.status === 'recognizing text') onProgress(m.progress || 0);
    };
    await w.setParameters({
      tessedit_pageseg_mode: String(psm),
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: whitelist
    });
    const r = await w.recognize(canvas, {}, { text: true, blocks: true, tsv: false, hocr: false });
    return full ? shape(r.data) : r.data.text || '';
  };

  const fmtSize = b =>
    b < 1024
      ? b + ' B'
      : b < 1048576
        ? (b / 1024).toFixed(0) + ' KB'
        : (b / 1048576).toFixed(1) + ' MB';
  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  return {
    script,
    jszip,
    pdfjs,
    openPdf,
    pdfPageToCanvas,
    fileToCanvas,
    prep,
    ocr,
    fmtSize,
    download
  };
})();
