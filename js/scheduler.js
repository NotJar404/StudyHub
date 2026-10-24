/* ============================================================================
   js/scheduler.js  -  Class Scheduler (schedule.html)
   ----------------------------------------------------------------------------
   Press Ctrl+F and search for the words in quotes to jump to a part.

   WHERE TO CHANGE WHAT
   - Gemini scan address ....................... "const AI_URL"   (the server code is api/scan.js)
   - Wallpaper colour themes ................... "const COL"
   - Layout names .............................. "const LAYOUTS"
   - Wallpaper shape / size .................... "const dims"
   - Fonts offered in the Text tab ............. "const FONTS"
   - Text colour swatches ...................... "const TCOLS"
   - Box styles (Frosted glass, Solid ...) ..... "const PRESETS"
   - Try-it sample classes ..................... "const SAMPLE"
   - Wallpaper drawing (title, rows, boxes) .... "const paint"
   - Saved settings (remembered in the browser)  "const S = Object.assign"

   schedule.html holds the page structure; css/style.css (search "SCHEDULER") holds its look.
   ============================================================================ */

// ===== CLASS SCHEDULER =====
// 1) Scan a Certificate of Registration (photo or PDF) -> classes go straight into your list.
// 2) Your classes are drawn as a phone wallpaper you can download as a JPEG.
(() => {
  if (!$('#sch-form')) return;

  // Address of the serverless scan endpoint. Never empty — always points to /api/scan.
  const AI_URL = '/api/scan';

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // [name, text colour, -, -, accent, text on accent, background top, background bottom, default panel fill]
  const COL = [
    ['Snow', '#ffffff', '', '', '#f0b562', '#1a1208', '#c9833a', '#4d2a14', '#12141f'],
    ['Ink', '#2a2520', '', '', '#a85c1c', '#ffffff', '#fbeed8', '#efd3ab', '#ffffff'],
    ['Willow', '#f4fff6', '', '', '#a8e0b5', '#10281c', '#3c8765', '#10281c', '#14342a'],
    ['Rose', '#3a1f26', '', '', '#b5475f', '#ffffff', '#f8cdd6', '#e58aa0', '#fff0f4'],
    ['Ocean', '#eaf6ff', '', '', '#7cc4f5', '#0b2038', '#2a77b5', '#0b2038', '#0e2644']
  ];
  const LAYOUTS = [
    ['Stacked days', 'One day per row'],
    ['Grouped list', 'All days in one shared panel'],
    ['Day columns', 'Weekday circles and class stacks'],
    ['Timeline', 'Connected days, clear rows']
  ];
  // One wallpaper size that suits every phone (20:9). Phones scale it to cover the screen, so the content stays inside a safe area.
  const SIZES = [['Fits every phone', 1080, 2400]];
  // On a phone the wallpaper takes the exact shape of that screen; anywhere else it is 20:9, which suits most phones.
  const dims = () => {
    let r = 2400 / 1080;
    try {
      if (matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) <= 900)
        r = Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height);
    } catch (e) {}
    r = Math.min(Math.max(r, 1.7), 2.4);
    return [1080, Math.round(1080 * r)];
  };

  let items = store.get('sch5', null);
  if (!items) items = store.get('sch4', []);
  let bgData = store.get('sbg', null),
    editIdx = null,
    bgImg = null;
  // the look of the wallpaper
  const DEFDC = ['#e5707e', '#f0a25a', '#e8c35a', '#5fb98c', '#5b9bd5', '#9b7bd1'];
  const S = Object.assign(
    {
      lay: 0,
      col: 0,
      size: 0,
      clock: true,
      fillOn: true,
      fill: '#12141f',
      fillOp: 62,
      pd: 0,
      dc: ['#e5707e', '#f0a25a', '#e8c35a', '#5fb98c', '#5b9bd5', '#9b7bd1'],
      lineOn: false,
      line: '#f0b562',
      lineW: 2,
      wf: 100,
      px: 50,
      py: 18,
      tOn: true,
      title: 'My Weekly Schedule',
      tPos: 'left',
      ff: 0,
      fs: 100,
      tcol: '',
      to: 100
    },
    store.get('sch6s', {})
  );
  S.lay = Math.min(Math.max(+S.lay || 0, 0), 3);
  S.col = Math.min(Math.max(+S.col || 0, 0), COL.length - 1);
  S.size = Math.min(Math.max(+S.size || 0, 0), SIZES.length - 1);

  const t12 = t => {
    const [h, m] = t.split(':').map(Number);
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
  };
  const keyOf = x => [x.code, x.day, x.start, x.end].join('|');

  // =================================================================
  //  SCANNING: the file goes to /api/scan, Gemini reads it, rows go straight into the list
  // =================================================================
  let cor = null,
    snapshot = null,
    lastFile = null;
  const msg = (t, kind) => {
    const m = $('#cor-msg');
    m.innerHTML = t;
    m.dataset.k = kind || '';
  };
  const bar = pct => {
    const b = $('#scan-bar');
    if (b) {
      b.hidden = pct <= 0;
      b.querySelector('i').style.width = Math.min(100, pct) + '%';
    }
  };

  const addScanned = res => {
    snapshot = items.map(x => ({ ...x }));
    const have = new Set(items.map(keyOf));
    let n = 0;
    res.items.forEach(x => {
      const y = { ...x };
      delete y._li;
      delete y._noDay;
      if (!have.has(keyOf(y))) {
        items.push(y);
        have.add(keyOf(y));
        n++;
      }
    });
    draw();
    return n;
  };

  const finishScan = res => {
    bar(100);
    const n = addScanned(res);
    let m = n
      ? 'Added ' + n + ' class' + (n === 1 ? '' : 'es') + ' to your schedule.'
      : 'Those classes are already in your schedule.';
    if (res.unsure) m += ' ' + res.unsure + ' marked "check" may need a quick fix. Tap ✎ to edit.';
    if (res.mismatch)
      m +=
        ' <b>⚠ Your certificate says ' +
        res.total +
        ' total units but the scan adds up to ' +
        res.sum +
        '.</b> Double-check the units.';
    msg(m, res.unsure || res.mismatch ? 'warn' : 'ok');
    $('#cor-undo').hidden = !n;
    $('#classes').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  // ---------- PDF text extraction (fast, no AI needed) ----------
  const DAYMAP = {
    M: 'Monday',
    T: 'Tuesday',
    W: 'Wednesday',
    TH: 'Thursday',
    F: 'Friday',
    S: 'Saturday'
  };
  const expandDays = str => {
    const s = str.toUpperCase().trim();
    const out = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === 'T' && s[i + 1] === 'H') {
        out.push('Thursday');
        i += 2;
      } else if (DAYMAP[s[i]]) {
        out.push(DAYMAP[s[i]]);
        i++;
      } else i++;
    }
    return [...new Set(out)];
  };
  const TIME_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)?/gi;
  const parseTime = s => {
    const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = +m[1],
      mm = m[2];
    if (m[3]) {
      if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return String(h).padStart(2, '0') + ':' + mm;
  };

  // Try to parse COR text locally — returns {items,totalUnits} or null if it can't
  const parseCorText = text => {
    if (!text || text.trim().length < 30) return null;
    // This parser handles common QCU COR text-layer formats
    // We'll send it to the server if local parsing fails
    return null; // Always delegate to server for accuracy
  };

  // ---------- Send to /api/scan (AI path) ----------
  const aiScan = async (imageB64, mime, pdfText) => {
    const body = pdfText ? { text: pdfText } : { image: imageB64, mime: mime || 'image/jpeg' };
    const ctl = new AbortController(),
      to = setTimeout(() => ctl.abort(), 50000);
    try {
      const r = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        let parsed;
        try {
          parsed = JSON.parse(detail);
        } catch (e) {}
        const errMsg = parsed?.detail || parsed?.error || 'HTTP ' + r.status;
        throw new Error(errMsg);
      }
      const j = await r.json(),
        T = /^([01]?\d|2[0-3]):[0-5]\d$/;
      const out = (j.items || [])
        .filter(x => x && DAYS.includes(x.day) && T.test(x.start) && T.test(x.end))
        .map(x => ({
          code: String(x.code || 'CLASS')
            .trim()
            .toUpperCase(),
          subj: String(x.subj || '').trim(),
          day: x.day,
          type: x.type === 'Lab' ? 'Lab' : 'Lec',
          units: x.units == null ? '' : String(x.units),
          start: x.start.padStart(5, '0'),
          end: x.end.padStart(5, '0'),
          room: String(x.room || '').trim()
        }));
      if (!out.length) throw new Error('empty');
      const sum = out.reduce((a, x) => a + (+x.units || 0), 0),
        total = +j.totalUnits || 0;
      return { items: out, unsure: 0, mismatch: !!(total && sum && sum !== total), sum, total };
    } finally {
      clearTimeout(to);
    }
  };

  // ---------- Image resize helper ----------
  const resizeForUpload = canvas => {
    const k = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
    if (k >= 1) return canvas;
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  };

  // ---------- Extract text from PDF ----------
  const extractPdfText = async file => {
    try {
      const lib = await Lib.pdfjs();
      const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let allText = '';
      for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = tc.items.map(i => i.str).join(' ');
        allText += pageText + '\n';
      }
      return allText.trim();
    } catch (e) {
      console.warn('PDF text extraction failed:', e);
      return '';
    }
  };

  // ---------- Skeleton loading UI ----------
  const showSkeleton = () => {
    const el = $('#classes');
    el.innerHTML =
      '<div class="skel-wrap">' +
      [1, 2, 3, 4, 5]
        .map(
          () =>
            '<div class="skel-row"><div class="skel-block sb1"></div><div class="skel-block sb2"></div><div class="skel-block sb3"></div></div>'
        )
        .join('') +
      '</div>';
  };

  // ---------- Main scan orchestration ----------
  let scanning = false;
  const scan = async () => {
    if ((!cor && !lastFile) || scanning) return;
    scanning = true;
    $('#cor-scan').disabled = true;
    $('#cor-undo').hidden = true;
    bar(15);
    showSkeleton();
    const retryBtn = $('#cor-retry');
    if (retryBtn) retryBtn.hidden = true;

    try {
      let pdfText = '';
      // If the original file was a PDF, try text extraction first
      if (lastFile && (/pdf/i.test(lastFile.type) || /\.pdf$/i.test(lastFile.name))) {
        msg('📄 Extracting text from your PDF…');
        bar(20);
        pdfText = await extractPdfText(lastFile);
        if (pdfText && pdfText.length > 50) {
          // Has a text layer — send text to server for structured parsing
          msg('⚡ Reading your certificate…');
          bar(40);
          try {
            const res = await aiScan(null, null, pdfText);
            finishScan(res);
            scanning = false;
            $('#cor-scan').disabled = false;
            return;
          } catch (e) {
            console.warn('Text-based scan failed, falling back to image:', e);
            // Fall through to image-based scan
          }
        }
      }

      // Image-based scan
      if (!cor) {
        msg('I could not read this file. Please try a clearer photo or PDF.', 'warn');
        bar(0);
        scanning = false;
        $('#cor-scan').disabled = false;
        return;
      }
      msg('⚡ Reading your certificate…');
      bar(30);
      const small = resizeForUpload(cor);
      const imageB64 = small.toDataURL('image/jpeg', 0.8).split(',')[1];
      bar(50);
      const res = await aiScan(imageB64, 'image/jpeg', null);
      finishScan(res);
    } catch (e) {
      console.error('Scan failed:', e);
      bar(0);
      const isNetErr = e.name === 'AbortError' || e.message.includes('Failed to fetch');
      const isEmpty = e.message === 'empty';
      let errHtml;
      if (isEmpty) {
        errHtml =
          'I could not find any classes in this image. Make sure the photo shows the full class table, is upright, and well lit.';
      } else if (isNetErr) {
        errHtml = 'Could not reach the reader. Check your internet and try again.';
      } else {
        errHtml =
          'The reader could not process this image. <small>(' +
          esc(e.message.slice(0, 120)) +
          ')</small>';
      }
      errHtml += ' <button type="button" class="ghost sm" id="cor-retry">Try again</button>';
      msg(errHtml, 'warn');
      const rb = $('#cor-retry');
      if (rb) rb.onclick = scan;
    }
    scanning = false;
    $('#cor-scan').disabled = false;
  };

  const showCor = () => {
    const t = document.createElement('canvas'),
      k = Math.min(1, 900 / Math.max(cor.width, cor.height));
    t.width = Math.round(cor.width * k);
    t.height = Math.round(cor.height * k);
    t.getContext('2d').drawImage(cor, 0, 0, t.width, t.height);
    $('#cor-img').src = t.toDataURL('image/jpeg', 0.7);
    $('#cor-box').hidden = false;
  };
  const loadCor = async f => {
    if (!f) return;
    lastFile = f;
    msg('Opening your file…');
    $('#cor-box').hidden = false;
    bar(5);
    try {
      cor = await Lib.fileToCanvas(f, 3200);
      showCor();
      // Auto-scan immediately
      await scan();
    } catch (e) {
      msg('I could not open that file. Please use a photo (JPG or PNG) or a PDF.', 'warn');
      bar(0);
    }
  };
  // Start scan immediately when a file is chosen
  $('#cor-file').onchange = e => {
    loadCor(e.target.files[0]);
    e.target.value = '';
  };
  const dz = $('#cor-dz');
  ['dragenter', 'dragover'].forEach(v =>
    dz.addEventListener(v, e => {
      e.preventDefault();
      dz.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach(v =>
    dz.addEventListener(v, e => {
      e.preventDefault();
      dz.classList.remove('over');
    })
  );
  dz.addEventListener('drop', e => loadCor(e.dataTransfer.files[0]));
  const rot = d => {
    if (!cor) return;
    const c = document.createElement('canvas');
    c.width = cor.height;
    c.height = cor.width;
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate((d * Math.PI) / 2);
    g.drawImage(cor, -cor.width / 2, -cor.height / 2);
    cor = c;
    showCor();
  };
  $('#rot-l').onclick = () => rot(-1);
  $('#rot-r').onclick = () => rot(1);
  $('#cor-scan').onclick = scan;
  $('#cor-undo').onclick = () => {
    if (snapshot) {
      items = snapshot;
      snapshot = null;
      draw();
      $('#cor-undo').hidden = true;
      msg('Scan removed.');
    }
  };
  // =================================================================
  //  YOUR CLASSES (list + edit/delete)
  // =================================================================
  const form = $('#sch-form');
  const resetForm = () => {
    editIdx = null;
    form.reset();
    $('#add-main').textContent = 'Add class';
    $('#add-keep').hidden = false;
    $('#add-cancel').hidden = true;
  };
  const read = () => ({
    code: form.code.value.trim().toUpperCase(),
    subj: form.subj.value.trim(),
    day: form.day.value,
    type: form.type.value,
    units: form.units.value,
    start: form.start.value,
    end: form.end.value,
    room: form.room.value.trim()
  });
  const add = keep => {
    if (!form.reportValidity()) return;
    if (form.start.value >= form.end.value) return alert('End time must be after start time.');
    const it = read();
    if (editIdx != null) {
      items[editIdx] = it;
      resetForm();
    } else {
      items.push(it);
      form.start.value = form.end.value = form.room.value = '';
      if (keep) form.type.value = form.type.value === 'Lec' ? 'Lab' : 'Lec';
      else form.code.value = form.subj.value = form.units.value = '';
    }
    draw();
  };
  form.onsubmit = e => {
    e.preventDefault();
    add(false);
  };
  $('#add-keep').onclick = () => add(true);
  $('#add-cancel').onclick = resetForm;
  {
    const ca = $('#clear-all'),
      un = $('#clear-undo'),
      label = ca.textContent;
    let t = 0,
      saved = null;
    const arm = on => {
      clearTimeout(t);
      ca.classList.toggle('danger', on);
      ca.textContent = on ? 'Tap again to clear' : label;
      ca.dataset.armed = on ? '1' : '';
      if (on) t = setTimeout(() => arm(false), 3500);
    };
    ca.onclick = () => {
      if (!items.length) return;
      if (!ca.dataset.armed) {
        arm(true);
        return;
      }
      arm(false);
      saved = items.map(x => ({ ...x }));
      snapshot = null;
      items = [];
      resetForm();
      un.hidden = false;
      draw();
      const am = $('#alt-msg');
      am.textContent = 'All classes removed.';
      am.dataset.k = 'ok';
      $('#cor-undo').hidden = true;
    };
    un.onclick = () => {
      if (saved) {
        items = saved;
        saved = null;
        un.hidden = true;
        draw();
        const am = $('#alt-msg');
        am.textContent = 'Classes restored.';
        am.dataset.k = 'ok';
      }
    };
    ca._sync = () => {
      ca.disabled = !items.length;
      if (items.length) un.hidden = true;
      if (!items.length) arm(false);
    };
  }
  $('#classes').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === 'del') {
      items.splice(i, 1);
      if (editIdx === i) resetForm();
      draw();
    }
    if (b.dataset.a === 'edit') {
      const x = items[i];
      editIdx = i;
      form.code.value = x.code;
      form.subj.value = x.subj;
      form.day.value = x.day;
      form.type.value = x.type;
      form.units.value = x.units || '';
      form.start.value = x.start;
      form.end.value = x.end;
      form.room.value = x.room || '';
      $('#add-main').textContent = 'Save changes';
      $('#add-keep').hidden = true;
      $('#add-cancel').hidden = false;
      $('#manual').open = true;
      form.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      form.code.focus();
    }
  });
  const drawList = () => {
    const el = $('#classes');
    if (!items.length) {
      el.innerHTML =
        '<p class="empty">No classes yet. Upload your certificate above to fill in your schedule.</p>';
      return;
    }
    const u = items.reduce((a, x) => a + (+x.units || 0), 0);
    let hdr =
      '<div class="class-summary">' +
      items.length +
      ' session' +
      (items.length === 1 ? '' : 's') +
      (u ? ' · ' + u + ' units' : '') +
      '</div>';
    el.innerHTML =
      hdr +
      DAYS.map(d => {
        const l = items
          .map((x, i) => ({ ...x, i }))
          .filter(x => x.day === d)
          .sort((a, b) => a.start.localeCompare(b.start));
        if (!l.length) return '';
        return (
          '<div class="dg"><div class="dgh"><b>' +
          d +
          '</b><small>' +
          l.length +
          ' session' +
          (l.length === 1 ? '' : 's') +
          '</small></div>' +
          l
            .map(
              x =>
                '<div class="cl"><div class="ct"><b>' +
                t12(x.start) +
                '</b><span>' +
                t12(x.end) +
                '</span></div><div class="cm"><div class="cc"><b>' +
                esc(x.code) +
                '</b><span class="lt' +
                (x.type === 'Lab' ? ' lab' : '') +
                '">' +
                (x.type === 'Lab' ? 'Lab' : 'Lec') +
                '</span>' +
                (x.chk ? '<span class="chk">check</span>' : '') +
                '</div><small>' +
                esc(x.subj) +
                '</small>' +
                (x.room ? '<em>' + esc(x.room) + '</em>' : '') +
                '</div><div class="ca"><button type="button" class="ib ibt" data-a="edit" data-i="' +
                x.i +
                '" aria-label="Edit ' +
                esc(x.code) +
                '"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span>Edit</span></button><button type="button" class="ib ibt del" data-a="del" data-i="' +
                x.i +
                '" aria-label="Remove ' +
                esc(x.code) +
                '"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg><span>Remove</span></button></div></div>'
            )
            .join('') +
          '</div>'
        );
      }).join('');
  };

  // =================================================================
  //  WALLPAPER (drawn on a canvas, saved as a JPEG)
  // =================================================================
  const cv = $('#wall');
  let FONT = '"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif',
    HEAD = '"Fraunces",Georgia,serif';
  const SANS = '"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif',
    SERIF = '"Fraunces",Georgia,serif';
  const FONTS = [
    ['Default (mixed)', SANS, SERIF],
    ['DM Sans', SANS, SANS],
    ['Fraunces (serif)', SERIF, SERIF],
    ['Georgia', 'Georgia,serif', 'Georgia,serif'],
    ['Trebuchet MS', '"Trebuchet MS",Tahoma,sans-serif', '"Trebuchet MS",Tahoma,sans-serif'],
    ['Courier New', '"Courier New",monospace', '"Courier New",monospace'],
    ['Poppins (clean)', '"Poppins",system-ui,sans-serif', '"Poppins",system-ui,sans-serif'],
    ['Nunito (rounded)', '"Nunito",system-ui,sans-serif', '"Nunito",system-ui,sans-serif'],
    ['Quicksand (soft)', '"Quicksand",system-ui,sans-serif', '"Quicksand",system-ui,sans-serif'],
    ['Montserrat (modern)', '"Montserrat",system-ui,sans-serif', '"Montserrat",system-ui,sans-serif'],
    ['Space Grotesk (techy)', '"Space Grotesk",system-ui,sans-serif', '"Space Grotesk",system-ui,sans-serif'],
    ['Lora (book serif)', '"Lora",Georgia,serif', '"Lora",Georgia,serif'],
    ['Playfair + Nunito (elegant)', '"Nunito",system-ui,sans-serif', '"Playfair Display",Georgia,serif'],
    ['Handwritten + Nunito', '"Nunito",system-ui,sans-serif', '"Caveat","Segoe Script",cursive']
  ];
  const TCOLS = ['#ffffff', '#241d16', '#f0b562', '#f6a5b8', '#7cc4f5'];
  const DAB = {
    Monday: 'M',
    Tuesday: 'T',
    Wednesday: 'W',
    Thursday: 'Th',
    Friday: 'F',
    Saturday: 'S'
  };
  // colour helpers
  const hx = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  };
  const lum = c => {
    const [r, g, b] = hx(c).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const mixHex = (a, b, t) =>
    '#' +
    hx(a)
      .map((v, i) =>
        Math.round(v * (1 - t) + hx(b)[i] * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  const rgba = (c, a) => {
    const [r, g, b] = hx(c);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  };
  const theme = () => {
    const p = COL[S.col],
      panelOn = S.fillOn && S.fillOp >= 35;
    let tc = p[1],
      ac = p[4];
    if (panelOn) {
      const light = lum(S.fill) > 0.4;
      tc = light ? '#241d16' : '#ffffff';
      if (contrast(ac, S.fill) < 3.2)
        ac = light ? mixHex(ac, '#000000', 0.55) : mixHex(ac, '#ffffff', 0.5);
    }
    const hd = contrast(ac, '#ffffff') > contrast(ac, '#111111') ? '#ffffff' : '#111111';
    return { tc, ac, hd, panelOn };
  };
  // per-day colours: each weekday gets its own box colour; text and accent are re-picked so they stay readable
  const bestText = c => (contrast(c, '#ffffff') >= contrast(c, '#241d16') ? '#ffffff' : '#241d16');
  const dayTheme = (d, base) => {
    if (!S.pd || !S.fillOn || !d) return base;
    const p = COL[S.col],
      i = Math.max(0, DAYS.indexOf(d)),
      col = S.dc[i] || S.fill,
      op = Math.min(1, Math.max(0, S.fillOp / 100));
    const eff = mixHex(
      col,
      mixHex(p[6], p[7], 0.5),
      1 - op < 0.05 ? 0 : Math.min(0.6, (1 - op) * 0.75)
    );
    const tc = bestText(eff);
    let ac = p[4];
    if (contrast(ac, eff) < 3.2)
      ac = tc === '#ffffff' ? mixHex(ac, '#ffffff', 0.55) : mixHex(ac, '#000000', 0.55);
    const hd = contrast(ac, '#ffffff') > contrast(ac, '#111111') ? '#ffffff' : '#111111';
    return { tc, ac, hd, panelOn: S.fillOp >= 35 };
  };
  const rr = (g, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const wrap = (g, text, maxW, maxLines) => {
    const words = String(text).split(/\s+/),
      lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width <= maxW || !cur) cur = t;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      let last = lines.slice(maxLines - 1).join(' ');
      while (last.length > 1 && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines.length = maxLines - 1;
      lines.push(last.trimEnd() + '…');
    }
    return lines;
  };
  const makeBg = (W, H, p) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (bgImg && bgImg.complete && bgImg.naturalWidth) {
      const k = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight),
        w = bgImg.naturalWidth * k,
        h = bgImg.naturalHeight * k;
      g.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      const gr = g.createLinearGradient(0, 0, W * 0.4, H);
      gr.addColorStop(0, p[6]);
      gr.addColorStop(1, p[7]);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W * 0.8, H * 0.12, 10, W * 0.8, H * 0.12, W * 0.9);
      rg.addColorStop(0, 'rgba(255,255,255,.22)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    return c;
  };

  // Lays out (and, when go is true, paints) the whole schedule at scale s. Returns the height used in "logical" pixels.
  const paint = (g, s, W, Lw, th, bgc, ox, oy, go) => {
    let { tc, ac, hd, panelOn } = th;
    const canBlur = 'filter' in g;
    const tcol = h => (S.to < 100 && /^#[0-9a-f]{6}$/i.test(h) ? rgba(h, S.to / 100) : h);
    const tpick = h => tcol(/^#[0-9a-f]{6}$/i.test(S.tcol) ? S.tcol : h);
    tc = tpick(tc);
    {
      const k = Math.min(Math.max(+S.fs || 100, 70), 130) / 100,
        fd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
      if (k === 1) delete g.font;
      else
        Object.defineProperty(g, 'font', {
          configurable: true,
          get() {
            return fd.get.call(g);
          },
          set(v) {
            fd.set.call(
              g,
              String(v).replace(/(\d+(?:\.\d+)?)px/, (m, n) => (+n * k).toFixed(1) + 'px')
            );
          }
        });
    }
    const use = d => {
      const t = dayTheme(d, th);
      tc = tpick(t.tc);
      ac = t.ac;
      hd = t.hd;
      panelOn = t.panelOn;
    };
    const dim = a => {
        g.globalAlpha = a;
      },
      full = () => {
        g.globalAlpha = 1;
      };
    const soft = on => {
      g.shadowColor = 'rgba(0,0,0,.4)';
      g.shadowBlur = on && !panelOn ? 9 : 0;
    };
    const panel = (x, y, w, h, r, d) => {
      const fc = S.pd && d ? S.dc[Math.max(0, DAYS.indexOf(d))] || S.fill : S.fill;
      if (!go) return;
      if (S.fillOn && S.fillOp > 0) {
        if (S.fillOp < 92 && canBlur) {
          g.save();
          rr(g, x, y, w, h, r);
          g.clip();
          g.filter = 'blur(22px)';
          g.drawImage(bgc, -ox / s, -oy / s, W / s, bgc.height / s);
          g.filter = 'none';
          g.restore();
        }
        rr(g, x, y, w, h, r);
        g.fillStyle = rgba(fc, S.fillOp / 100);
        g.fill();
      }
      if (S.lineOn) {
        rr(g, x, y, w, h, r);
        g.strokeStyle = S.line;
        g.lineWidth = S.lineW;
        g.stroke();
      }
    };
    const byDay = d =>
      items.filter(x => x.day === d).sort((a, b) => a.start.localeCompare(b.start));
    const days = DAYS.filter(d => byDay(d).length);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    let y = 0;
    // title
    const ttl = (S.title || '').trim(),
      showT = S.tOn && ttl,
      ax = S.tPos === 'center' ? Lw / 2 : S.tPos === 'right' ? Lw : 0;
    if (go && showT) {
      g.fillStyle = tc;
      let fs = 78;
      g.font = '500 ' + fs + 'px ' + HEAD;
      if (g.font && 1) {
        let n = 0;
        while (g.measureText(ttl).width > Lw && n++ < 30) {
          fs -= 3;
          g.font = '500 ' + fs + 'px ' + HEAD;
        }
      }
      g.textAlign = S.tPos === 'center' ? 'center' : S.tPos === 'right' ? 'right' : 'left';
      soft(true);
      g.fillText(ttl, ax, y + 66);
      g.shadowBlur = 0;
      g.textAlign = 'left';
    }
    y += showT ? 96 : 14;
    const u = items.reduce((a, x) => a + (+x.units || 0), 0);
    if (go) {
      g.font = '500 30px ' + FONT;
      g.fillStyle = tc;
      g.textAlign = S.tPos === 'center' ? 'center' : S.tPos === 'right' ? 'right' : 'left';
      soft(true);
      dim(0.8);
      g.fillText(
        items.length +
          ' session' +
          (items.length === 1 ? '' : 's') +
          (u ? '  ·  ' + u + ' units' : ''),
        ax,
        y + 20
      );
      full();
      g.shadowBlur = 0;
      g.textAlign = 'left';
    }
    y += 70;

    // ----- one row of a class: time | code + type | subject | room -----
    const measure = (l, w, pad) =>
      l.map(x => {
        g.font = '700 29px ' + FONT;
        const roomW = x.room ? g.measureText(x.room).width + 40 : 0;
        g.font = '400 27px ' + FONT;
        const lines = wrap(g, x.subj, w - pad * 2 - 216 - (roomW ? roomW + 24 : 0), 2);
        return { x, lines, roomW, h: Math.max(122, 30 + 42 + lines.length * 34 + 22) };
      });
    const drawRow = (r, x0, top, w, pad) => {
      const mx = x0 + pad + 216;
      soft(true);
      g.fillStyle = tc;
      g.font = '700 33px ' + FONT;
      g.fillText(t12(r.x.start), x0 + pad, top + 54);
      g.font = '500 26px ' + FONT;
      dim(0.78);
      g.fillText(t12(r.x.end), x0 + pad, top + 90);
      full();
      g.font = '700 35px ' + FONT;
      g.fillStyle = tc;
      g.fillText(r.x.code, mx, top + 54);
      const cw = g.measureText(r.x.code).width;
      g.shadowBlur = 0;
      const lab = r.x.type === 'Lab';
      g.font = '700 19px ' + FONT;
      const tw = g.measureText(lab ? 'LAB' : 'LEC').width + 30;
      rr(g, mx + cw + 16, top + 27, tw, 34, 17);
      if (lab) {
        g.strokeStyle = ac;
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = ac;
      } else {
        g.fillStyle = ac;
        g.fill();
        g.fillStyle = hd;
      }
      g.textAlign = 'center';
      g.fillText(lab ? 'LAB' : 'LEC', mx + cw + 16 + tw / 2, top + 51);
      g.textAlign = 'left';
      soft(true);
      g.font = '400 27px ' + FONT;
      g.fillStyle = tc;
      dim(0.85);
      r.lines.forEach((t, j) => g.fillText(t, mx, top + 92 + j * 34));
      full();
      g.shadowBlur = 0;
      if (r.roomW) {
        const rx = x0 + w - pad - r.roomW;
        rr(g, rx, top + r.h / 2 - 28, r.roomW, 56, 28);
        g.strokeStyle = ac;
        g.lineWidth = 2;
        g.globalAlpha = 0.95;
        g.stroke();
        full();
        g.font = '700 29px ' + FONT;
        g.fillStyle = tc;
        g.textAlign = 'center';
        g.fillText(r.x.room, rx + r.roomW / 2, top + r.h / 2 + 10);
        g.textAlign = 'left';
      }
    };
    const sep = (x1, x2, yy, a) => {
      g.strokeStyle = panelOn ? tc : '#ffffff';
      g.globalAlpha = a;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x1, yy);
      g.lineTo(x2, yy);
      g.stroke();
      full();
    };
    const dayHead = (d, n, x, yy, w) => {
      g.font = '700 30px ' + FONT;
      g.fillStyle = ac;
      soft(true);
      let xx = x;
      for (const ch of d.toUpperCase()) {
        g.fillText(ch, xx, yy + 30);
        xx += g.measureText(ch).width + 4;
      }
      g.shadowBlur = 0;
      g.font = '500 24px ' + FONT;
      g.fillStyle = tc;
      dim(0.78);
      g.textAlign = 'right';
      g.fillText(n + (n === 1 ? ' class' : ' classes'), x + w, yy + 29);
      g.textAlign = 'left';
      full();
    };

    // ===== layout 1: STACKED DAYS (each day in its own panel) =====
    if (S.lay === 0) {
      days.forEach(d => {
        const l = byDay(d);
        y += 34;
        use(null);
        if (go) dayHead(d, l.length, 4, y, Lw - 8);
        y += 58;
        const rows = measure(l, Lw, 34),
          total = rows.reduce((a, r) => a + r.h, 0) + 28;
        use(d);
        panel(0, y, Lw, total, 30, d);
        let yy = y + 14;
        rows.forEach((r, i) => {
          if (go) {
            drawRow(r, 0, yy, Lw, 34);
            if (i < rows.length - 1) sep(34, Lw - 34, yy + r.h, panelOn ? 0.16 : 0.35);
          }
          yy += r.h;
        });
        y += total;
      });
    }
    // ===== layout 2: GROUPED LIST (everything in one shared panel) =====
    else if (S.lay === 1) {
      y += 10;
      const blocks = days.map(d => ({ d, rows: measure(byDay(d), Lw, 34) }));
      const perDay = S.pd && S.fillOn;
      const total = perDay
        ? blocks.reduce((a, b) => a + 78 + b.rows.reduce((t, r) => t + r.h, 0) + 38, 0) - 10
        : blocks.reduce((a, b) => a + 78 + b.rows.reduce((t, r) => t + r.h, 0), 0) + 30;
      if (!perDay) panel(0, y, Lw, total, 34);
      let yy = y + 14;
      blocks.forEach((b, bi) => {
        const bh = 78 + b.rows.reduce((t, r) => t + r.h, 0);
        if (perDay) {
          use(b.d);
          panel(0, yy - 14, Lw, bh + 28, 34, b.d);
        }
        if (go) {
          if (bi > 0 && !perDay) sep(34, Lw - 34, yy - 4, panelOn ? 0.35 : 0.5);
          dayHead(b.d, b.rows.length, 34, yy + 14, Lw - 68);
        }
        yy += 78;
        b.rows.forEach((r, i) => {
          if (go) {
            drawRow(r, 0, yy, Lw, 34);
            if (i < b.rows.length - 1) sep(34, Lw - 34, yy + r.h, panelOn ? 0.12 : 0.3);
          }
          yy += r.h;
        });
        if (perDay) yy += 38;
      });
      use(null);
      y += total;
    }
    // ===== layout 3: DAY COLUMNS (weekday circles with class stacks) =====
    else if (S.lay === 2) {
      y += 30;
      const n = Math.max(1, days.length),
        gap = 14,
        colW = (Lw - gap * (n - 1)) / n,
        dia = Math.min(colW - 10, 108);
      let tall = 0;
      days.forEach((d, ci) => {
        const x = ci * (colW + gap),
          l = byDay(d);
        use(d);
        if (go) {
          const cx = x + colW / 2,
            cy = y + dia / 2;
          g.beginPath();
          g.arc(cx, cy, dia / 2, 0, Math.PI * 2);
          if (S.fillOn) {
            g.fillStyle = rgba(
              S.pd ? S.dc[Math.max(0, DAYS.indexOf(d))] || S.fill : S.fill,
              Math.max(0.35, S.fillOp / 100)
            );
            g.fill();
          } else {
            g.fillStyle = rgba('#000000', 0.28);
            g.fill();
          }
          g.strokeStyle = S.lineOn ? S.line : ac;
          g.lineWidth = S.lineOn ? S.lineW : 3;
          g.stroke();
          g.fillStyle = ac;
          g.font = '700 ' + (dia > 90 ? 40 : 32) + 'px ' + FONT;
          g.textAlign = 'center';
          g.fillText(DAB[d], cx, cy + 14);
          g.textAlign = 'left';
        }
        let yy = y + dia + 22;
        l.forEach(c => {
          const h = 190;
          panel(x, yy, colW, h, 22, d);
          if (go) {
            const cx = x + colW / 2;
            g.textAlign = 'center';
            let fs = 30;
            g.font = '700 ' + fs + 'px ' + FONT;
            while (g.measureText(c.code).width > colW - 16 && fs > 18) {
              fs -= 2;
              g.font = '700 ' + fs + 'px ' + FONT;
            }
            soft(true);
            g.fillStyle = tc;
            g.fillText(c.code, cx, yy + 44);
            g.shadowBlur = 0;
            const lab = c.type === 'Lab';
            g.font = '700 15px ' + FONT;
            const tw = g.measureText(lab ? 'LAB' : 'LEC').width + 22;
            rr(g, cx - tw / 2, yy + 58, tw, 26, 13);
            if (lab) {
              g.strokeStyle = ac;
              g.lineWidth = 2;
              g.stroke();
              g.fillStyle = ac;
            } else {
              g.fillStyle = ac;
              g.fill();
              g.fillStyle = hd;
            }
            g.fillText(lab ? 'LAB' : 'LEC', cx, yy + 77);
            soft(true);
            g.fillStyle = tc;
            g.font = '600 21px ' + FONT;
            g.fillText(t12(c.start), cx, yy + 118);
            dim(0.75);
            g.font = '500 20px ' + FONT;
            g.fillText(t12(c.end), cx, yy + 144);
            full();
            if (c.room) {
              g.fillStyle = ac;
              g.font = '700 20px ' + FONT;
              g.shadowBlur = 0;
              g.fillText(c.room, cx, yy + 175);
            }
            g.shadowBlur = 0;
            g.textAlign = 'left';
          }
          yy += h + 14;
        });
        tall = Math.max(tall, yy - y);
      });
      use(null);
      y += tall;
    }
    // ===== layout 4: TIMELINE (days joined by a line) =====
    else {
      y += 26;
      const LP = 62,
        start = y,
        dots = [];
      days.forEach(d => {
        const l = byDay(d);
        dots.push(y + 22);
        use(null);
        if (go) dayHead(d, l.length, LP, y, Lw - LP);
        y += 62;
        use(d);
        measure(l, Lw - LP, 30).forEach(r => {
          panel(LP, y, Lw - LP, r.h, 26, d);
          if (go) drawRow(r, LP, y, Lw - LP, 30);
          y += r.h + 14;
        });
        y += 12;
      });
      use(null);
      if (go && dots.length) {
        g.strokeStyle = ac;
        g.globalAlpha = 0.8;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(20, dots[0]);
        g.lineTo(20, y - 26);
        g.stroke();
        full();
        dots.forEach(dy => {
          g.beginPath();
          g.arc(20, dy, 15, 0, Math.PI * 2);
          g.fillStyle = ac;
          g.fill();
          g.beginPath();
          g.arc(20, dy, 6, 0, Math.PI * 2);
          g.fillStyle = hd;
          g.fill();
        });
      }
      y -= 12;
    }
    return y;
  };

  let drawQueued = false;
  const renderWall = () => {
    {
      const f = FONTS[S.ff] || FONTS[0];
      FONT = f[1];
      HEAD = f[2];
    }
    const [W, H] = dims(),
      p = COL[S.col],
      th = theme();
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const g = cv.getContext('2d'),
      bgc = makeBg(W, H, p);
    g.clearRect(0, 0, W, H);
    g.drawImage(bgc, 0, 0);
    if (bgImg) {
      g.fillStyle = lum(p[6]) < 0.4 ? 'rgba(8,10,20,.22)' : 'rgba(255,255,255,.16)';
      g.fillRect(0, 0, W, H);
    }
    const warn = $('#wall-warn');
    warn.textContent = '';
    if (!items.length) {
      g.fillStyle = th.tc;
      g.textAlign = 'center';
      g.font = '500 64px ' + HEAD;
      g.fillText('Your schedule', W / 2, H * 0.42);
      g.font = '400 32px ' + FONT;
      g.globalAlpha = 0.8;
      g.fillText('Upload your certificate to get started', W / 2, H * 0.42 + 60);
      g.globalAlpha = 1;
      g.textAlign = 'left';
      return;
    }
    // sample phone clock, preview only: it is NOT part of the saved wallpaper
    // Safe area: a 16:9 phone crops up to 10% of the height from the top and bottom, so nothing important sits there.
    // With the clock on, the schedule starts under the real lock-screen clock (about 28% down).
    const M = 64,
      top = S.clock ? Math.round(H * 0.28) : Math.round(H * 0.1),
      bottom = Math.round(H * 0.1),
      avail = H - top - bottom;
    const BW = ((W - 2 * M) * S.wf) / 100,
      left = M + ((W - 2 * M - BW) * S.px) / 100;
    let s = 1;
    const dummy = document.createElement('canvas').getContext('2d');
    for (; s >= 0.42; s -= 0.02) {
      const Lw = BW / s;
      if (paint(dummy, s, W, Lw, th, bgc, 0, 0, false) * s <= avail) break;
    }
    s = Math.max(0.42, s);
    const Lw = BW / s,
      h = paint(dummy, s, W, Lw, th, bgc, 0, 0, false) * s;
    if (h > avail)
      warn.textContent =
        'Too many classes to fit on one wallpaper. Turn off "Keep space for the clock" or remove a few.';
    const oy = top + (Math.max(0, avail - h) * S.py) / 100;
    g.save();
    g.translate(left, oy);
    g.scale(s, s);
    paint(g, s, W, Lw, th, bgc, left, oy, true);
    g.restore();
  };

  // ----- the controls -----
  const FILLS = ['#12141f', '#ffffff', '#fff3de', '#fde7ec', '#0e2644', '#14342a'];
  const LINES = ['#f0b562', '#ffffff', '#a85c1c', '#b5475f', '#7cc4f5', '#2a2520'];
  const ICON = p =>
    '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    p +
    '</svg>';
  const ICONS = [
    ICON(
      '<rect x="8" y="9" width="32" height="7" rx="3.5"/><rect x="8" y="20.5" width="32" height="7" rx="3.5"/><rect x="8" y="32" width="32" height="7" rx="3.5"/>'
    ),
    ICON(
      '<rect x="7" y="7" width="34" height="34" rx="6"/><path d="M14 16h5M23 16h11M14 24h5M23 24h11M14 32h5M23 32h11"/>'
    ),
    ICON(
      '<circle cx="12" cy="11" r="3"/><circle cx="24" cy="11" r="3"/><circle cx="36" cy="11" r="3"/><rect x="9" y="19" width="6" height="21" rx="2"/><rect x="21" y="19" width="6" height="14" rx="2"/><rect x="33" y="19" width="6" height="18" rx="2"/>'
    ),
    ICON(
      '<path d="M12 8v32"/><circle cx="12" cy="11" r="2.6"/><circle cx="12" cy="25" r="2.6"/><circle cx="12" cy="39" r="2.6" /><path d="M21 11h19M21 25h19M21 39h12"/>'
    )
  ];
  $('#layouts').innerHTML = LAYOUTS.map(
    (l, i) =>
      '<button type="button" class="lay-opt" aria-pressed="false"><i class="rad" aria-hidden="true"></i><span class="lay-ic">' +
      ICONS[i] +
      '</span><b>' +
      l[0] +
      '</b><small>' +
      l[1] +
      '</small></button>'
  ).join('');
  $('#colors').innerHTML = COL.map(
    c =>
      '<button type="button" class="dotc" style="background:linear-gradient(135deg,' +
      c[6] +
      ',' +
      c[7] +
      ')" aria-label="' +
      c[0] +
      '" title="' +
      c[0] +
      '" aria-pressed="false"></button>'
  ).join('');
  const swatches = (el, list, key) => {
    el.innerHTML =
      list
        .map(
          c =>
            '<button type="button" class="swc" data-c="' +
            c +
            '" style="background:' +
            c +
            '" aria-label="Color ' +
            c +
            '" aria-pressed="false"></button>'
        )
        .join('') +
      '<label class="swc custom" title="Pick any color"><input type="color" aria-label="Custom color"></label>';
    el.querySelectorAll('.swc[data-c]').forEach(
      b =>
        (b.onclick = () => {
          S[key] = b.dataset.c;
          draw();
        })
    );
    el.querySelector('input').oninput = e => {
      S[key] = e.target.value;
      draw();
    };
  };
  swatches($('#fill-sw'), FILLS, 'fill');
  swatches($('#line-sw'), LINES, 'line');
  $$('#layouts button').forEach(
    (b, i) =>
      (b.onclick = () => {
        S.lay = i;
        draw();
      })
  );
  $$('#colors button').forEach(
    (b, i) =>
      (b.onclick = () => {
        S.col = i;
        S.fill = COL[i][8];
        S.fillOn = true;
        S.line = COL[i][4];
        draw();
      })
  );
  $('#clock').onchange = e => {
    S.clock = e.target.checked;
    draw();
  };
  $('#fill-on').onchange = e => {
    S.fillOn = e.target.checked;
    draw();
  };
  $('#line-on').onchange = e => {
    S.lineOn = e.target.checked;
    draw();
  };
  [
    ['fill-op', 'fillOp', '%'],
    ['line-w', 'lineW', ' px'],
    ['p-w', 'wf', '%'],
    ['p-x', 'px', '%'],
    ['p-y', 'py', '%']
  ].forEach(([id, k, u]) => {
    $('#' + id).oninput = e => {
      S[k] = +e.target.value;
      draw();
    };
  });
  $('#p-reset').onclick = () => {
    S.lay = 0;
    S.wf = 100;
    S.px = 50;
    S.py = 18;
    draw();
  };

  // ----- container presets (they simply set the existing fill / outline controls) -----
  const PRESETS = [
    [
      'Frosted glass',
      'See-through fill',
      s => {
        s.pd = 0;
        s.fillOn = true;
        s.fillOp = 62;
        s.lineOn = false;
      },
      s => !s.pd && s.fillOn && !s.lineOn && s.fillOp < 96 && s.fillOp > 0
    ],
    [
      'Solid',
      'Opaque fill',
      s => {
        s.pd = 0;
        s.fillOn = true;
        s.fillOp = 100;
        s.lineOn = false;
      },
      s => !s.pd && s.fillOn && !s.lineOn && s.fillOp >= 96
    ],
    [
      'Solid color',
      'A color for each day',
      s => {
        s.pd = 1;
        s.fillOn = true;
        s.fillOp = 100;
        s.lineOn = false;
      },
      s => s.pd && s.fillOn && s.fillOp >= 96
    ],
    [
      'Colored glass',
      'See-through day colors',
      s => {
        s.pd = 1;
        s.fillOn = true;
        s.fillOp = 62;
        s.lineOn = false;
      },
      s => s.pd && s.fillOn && s.fillOp < 96
    ],
    [
      'Outline',
      'Border only',
      s => {
        s.pd = 0;
        s.fillOn = false;
        s.lineOn = true;
        s.lineW = Math.max(s.lineW, 3);
      },
      s => !s.fillOn && s.lineOn
    ],
    [
      'No container',
      'Text without a box',
      s => {
        s.pd = 0;
        s.fillOn = false;
        s.lineOn = false;
      },
      s => !s.fillOn && !s.lineOn
    ]
  ];
  const PICO = [
    ICON(
      '<rect x="8" y="10" width="32" height="28" rx="8" stroke-dasharray="0"/><path d="M14 20h20M14 28h12" opacity=".5"/>'
    ),
    ICON(
      '<rect x="8" y="10" width="32" height="28" rx="8" fill="currentColor" opacity=".25"/><rect x="8" y="10" width="32" height="28" rx="8"/>'
    ),
    ICON(
      '<rect x="8" y="9" width="32" height="9" rx="4" fill="currentColor" opacity=".55"/><rect x="8" y="20" width="32" height="9" rx="4" fill="currentColor" opacity=".35"/><rect x="8" y="31" width="32" height="9" rx="4" fill="currentColor" opacity=".18"/>'
    ),
    ICON(
      '<rect x="8" y="9" width="32" height="9" rx="4"/><rect x="8" y="20" width="32" height="9" rx="4" stroke-dasharray="0" opacity=".7"/><rect x="8" y="31" width="32" height="9" rx="4" opacity=".4"/>'
    ),
    ICON('<rect x="8" y="10" width="32" height="28" rx="8" stroke-dasharray="4 4"/>'),
    ICON('<circle cx="24" cy="24" r="14"/><path d="M14 34 34 14"/>')
  ];
  $('#presets').innerHTML = PRESETS.map(
    (p, i) =>
      '<button type="button" class="lay-opt" aria-pressed="false"><i class="rad" aria-hidden="true"></i><span class="lay-ic">' +
      PICO[i] +
      '</span><b>' +
      p[0] +
      '</b><small>' +
      p[1] +
      '</small></button>'
  ).join('');
  $$('#presets button').forEach(
    (b, i) =>
      (b.onclick = () => {
        PRESETS[i][2](S);
        draw();
      })
  );
  const DLAB = ['M', 'T', 'W', 'Th', 'F', 'S'];
  $('#daycols-in').innerHTML = DAYS.map(
    (d, i) =>
      '<label class="dcol"><span class="dcs" style="background:' +
      S.dc[i] +
      '"><input type="color" value="' +
      S.dc[i] +
      '" data-i="' +
      i +
      '" aria-label="Color for ' +
      d +
      '"></span><b>' +
      DLAB[i] +
      '</b></label>'
  ).join('');
  $$('#daycols-in input').forEach(
    inp =>
      (inp.oninput = e => {
        S.dc[+inp.dataset.i] = e.target.value;
        inp.parentElement.style.background = e.target.value;
        draw();
      })
  );
  $('#c-reset').onclick = () => {
    S.pd = 0;
    S.dc = DEFDC.slice();
    S.fillOn = true;
    S.fill = COL[S.col][8];
    S.fillOp = 62;
    S.lineOn = false;
    S.line = COL[S.col][4];
    S.lineW = 2;
    draw();
  };
  // ----- text controls -----
  $('#t-font').innerHTML = FONTS.map(
    (f, i) => '<option value="' + i + '">' + f[0] + '</option>'
  ).join('');
  $('#t-pos').innerHTML = [
    ['left', 'Left'],
    ['center', 'Center'],
    ['right', 'Right']
  ]
    .map(
      p => '<button type="button" data-p="' + p[0] + '" aria-pressed="false">' + p[1] + '</button>'
    )
    .join('');
  $$('#t-pos button').forEach(
    b =>
      (b.onclick = () => {
        S.tPos = b.dataset.p;
        draw();
      })
  );
  $('#t-on').onchange = e => {
    S.tOn = e.target.checked;
    draw();
  };
  $('#t-title').oninput = e => {
    S.title = e.target.value;
    draw();
  };
  $('#t-font').onchange = e => {
    S.ff = +e.target.value;
    draw();
    const f = FONTS[S.ff];
    if (document.fonts && document.fonts.load)
      Promise.all(
        [f[1], f[2]].flatMap(fam => [400, 500, 600, 700].map(w => document.fonts.load(w + ' 30px ' + fam)))
      )
        .then(() => draw())
        .catch(() => {});
  };
  [
    ['t-fs', 'fs', '%'],
    ['t-op', 'to', '%']
  ].forEach(([id, k, u]) => {
    $('#' + id).oninput = e => {
      S[k] = +e.target.value;
      draw();
    };
  });
  $('#t-sw').innerHTML =
    TCOLS.map(
      c =>
        '<button type="button" class="swc" data-c="' +
        c +
        '" style="background:' +
        c +
        '" aria-label="Text color ' +
        c +
        '" aria-pressed="false"></button>'
    ).join('') +
    '<label class="swc custom" title="Pick any color"><input type="color" aria-label="Custom text color"></label>';
  $$('#t-sw .swc[data-c]').forEach(
    b =>
      (b.onclick = () => {
        S.tcol = b.dataset.c;
        draw();
      })
  );
  $('#t-sw input').oninput = e => {
    S.tcol = e.target.value;
    draw();
  };
  $('#t-auto').onclick = () => {
    S.tcol = '';
    draw();
  };
  $('#t-reset').onclick = () => {
    S.tOn = true;
    S.title = 'My Weekly Schedule';
    S.tPos = 'left';
    S.ff = 0;
    S.fs = 100;
    S.tcol = '';
    S.to = 100;
    draw();
  };
  // ----- tabs -----
  const tabs = $$('.tabs [role=tab]');
  const showTab = t => {
    tabs.forEach(b => {
      const on = b === t;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
      $('#' + b.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((b, i) => {
    b.onclick = () => showTab(b);
    b.onkeydown = e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      const n = tabs[(i + k + tabs.length) % tabs.length];
      showTab(n);
      n.focus();
    };
  });
  // ----- friendly starting points -----
  const SAMPLE = [
    ['CS101', 'Introduction to Computing', 'Monday', 'Lec', '3', '08:00', '09:30', 'Room 101'],
    [
      'GE104',
      'Mathematics in the Modern World',
      'Tuesday',
      'Lec',
      '3',
      '10:00',
      '11:30',
      'Room 301'
    ],
    ['GE105', 'Purposive Communication', 'Wednesday', 'Lec', '3', '13:00', '15:00', 'Room 204'],
    ['SCI101', 'General Physics', 'Thursday', 'Lab', '1', '09:00', '10:30', 'Lab 1'],
    ['GE106', 'Philippine History', 'Friday', 'Lec', '3', '11:00', '12:30', 'Room 205']
  ].map(([code, subj, day, type, units, start, end, room]) => ({
    code,
    subj,
    day,
    type,
    units,
    start,
    end,
    room
  }));
  $('#try-sample').onclick = () => {
    snapshot = items.map(x => ({ ...x }));
    const have = new Set(items.map(keyOf));
    let n = 0;
    SAMPLE.forEach(x => {
      if (!have.has(keyOf(x))) {
        items.push({ ...x });
        n++;
      }
    });
    draw();
    const am = $('#alt-msg');
    am.textContent = n
      ? 'Added 5 sample classes so you can try the designs. Use “Clear all” below to remove them.'
      : 'The sample is already in your schedule.';
    am.dataset.k = n ? 'ok' : '';
  };
  $('#go-manual').onclick = () => {
    const d = $('#manual');
    d.open = true;
    d.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => $('#code').focus({ preventScroll: true }), 300);
  };

  const draw = () => {
    $$('#layouts button').forEach((b, i) => {
      b.classList.toggle('sel', i === S.lay);
      b.setAttribute('aria-pressed', i === S.lay);
    });
    $$('#colors button').forEach((b, i) => {
      b.classList.toggle('sel', i === S.col);
      b.setAttribute('aria-pressed', i === S.col);
    });
    [
      ['fill-sw', 'fill'],
      ['line-sw', 'line']
    ].forEach(([id, k]) => {
      $$('#' + id + ' .swc[data-c]').forEach(b => {
        const on = b.dataset.c.toLowerCase() === String(S[k]).toLowerCase();
        b.classList.toggle('sel', on);
        b.setAttribute('aria-pressed', on);
      });
      const ci = $('#' + id + ' input');
      if (ci && /^#[0-9a-f]{6}$/i.test(S[k])) ci.value = S[k];
    });
    $('#clock').checked = S.clock;
    $('#fill-on').checked = S.fillOn;
    $('#line-on').checked = S.lineOn;
    [
      ['fill-op', 'fillOp', '%'],
      ['line-w', 'lineW', ' px'],
      ['p-w', 'wf', '%'],
      ['p-x', 'px', '%'],
      ['p-y', 'py', '%']
    ].forEach(([id, k, u]) => {
      $('#' + id).value = S[k];
      $('#' + id + '-o').textContent = S[k] + u;
    });
    $$('#presets button').forEach((b, i) => {
      const on = PRESETS[i][3](S);
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on);
    });
    {
      const k = $('#clk');
      k.hidden = !(S.clock && items.length);
      k.style.color = COL[S.col][1];
      $('#clk-date').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
    $('#daycols').hidden = !(S.pd && S.fillOn);
    $$('#daycols-in input').forEach(inp => {
      inp.value = S.dc[+inp.dataset.i];
      inp.parentElement.style.background = S.dc[+inp.dataset.i];
    });
    $('#fill-sw')
      .closest('.crow')
      .classList.toggle('bypd', !!(S.pd && S.fillOn));
    $('#fill-box').classList.toggle('off', !S.fillOn);
    $('#line-box').classList.toggle('off', !S.lineOn);
    $('#t-on').checked = S.tOn;
    if ($('#t-title').value !== S.title) $('#t-title').value = S.title;
    $('#t-title').disabled = !S.tOn;
    $$('#t-pos button').forEach(b => {
      const on = b.dataset.p === S.tPos;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on);
    });
    $('#t-font').value = S.ff;
    [
      ['t-fs', 'fs', '%'],
      ['t-op', 'to', '%']
    ].forEach(([id, k, u]) => {
      $('#' + id).value = S[k];
      $('#' + id + '-o').textContent = S[k] + u;
    });
    $$('#t-sw .swc[data-c]').forEach(b => {
      const on = b.dataset.c.toLowerCase() === String(S.tcol).toLowerCase();
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on);
    });
    $('#t-auto').classList.toggle('sel', !S.tcol);
    {
      const ci = $('#t-sw input');
      if (/^#[0-9a-f]{6}$/i.test(S.tcol)) ci.value = S.tcol;
    }
    drawList();
    $('#clear-all')._sync && $('#clear-all')._sync();
    $('#sch-sum').textContent = items.length
      ? items.length +
        ' session' +
        (items.length === 1 ? '' : 's') +
        ' · ' +
        items.reduce((a, x) => a + (+x.units || 0), 0) +
        ' units'
      : 'Add classes to see your wallpaper';
    store.set('sch5', items);
    store.set('sch6s', S);
    store.set('sbg', bgData);
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      renderWall();
    });
  };

  const setBg = data => {
    bgData = data;
    if (!data) {
      bgImg = null;
      draw();
      return;
    }
    const im = new Image();
    im.onload = () => {
      bgImg = im;
      draw();
    };
    im.onerror = () => {
      bgImg = null;
      bgData = null;
      draw();
    };
    im.src = data;
  };
  $('#bg-file').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const c = await Lib.fileToCanvas(f, 1800);
      setBg(c.toDataURL('image/jpeg', 0.85));
    } catch (err) {
      alert('I could not open that photo.');
    }
  };
  $('#bg-clear').onclick = () => setBg(null);

  // ----- save as JPEG -----
  const toJpeg = () => new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.93));
  $('#sch-jpg').onclick = async () => {
    if (!items.length) return alert('Upload your certificate first to add classes.');
    const b = await toJpeg();
    Lib.download(b, 'my-class-schedule.jpg');
    $('#save-note').textContent =
      'Saved as my-class-schedule.jpg. Open it in your photos and set it as your wallpaper.';
  };
  const share = $('#sch-share');
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] })
  )
    share.hidden = false;
  share.onclick = async () => {
    if (!items.length) return alert('Upload your certificate first to add classes.');
    const b = await toJpeg();
    try {
      await navigator.share({
        files: [new File([b], 'my-class-schedule.jpg', { type: 'image/jpeg' })],
        title: 'My class schedule'
      });
    } catch (e) {}
  };

  // test hook (used by the automatic tests, harmless otherwise)

  setBg(bgData);
  document.fonts &&
    document.fonts.ready.then(() => {
      Promise.all(
        ['500 40px Fraunces', '400 20px "DM Sans"', '500 20px "DM Sans"', '700 20px "DM Sans"'].map(
          f => document.fonts.load(f)
        )
      )
        .then(draw)
        .catch(() => {});
    });
  draw();
})();
