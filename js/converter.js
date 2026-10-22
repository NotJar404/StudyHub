// ===== FILE CONVERTER =====
// Everything happens in your browser. Files are never uploaded anywhere.
// Idea: read the file into a simple "document" (sections of headings, paragraphs and bullets),
// then write that document out in the format you picked.
(() => {
  if (!$('#fc-file')) return;

  const ext = n => ((n.match(/\.([^.]+)$/) || [])[1] || '').toLowerCase();
  const base = n => n.replace(/\.[^.]+$/, '') || 'file';
  const KIND = {
    pdf: 'pdf',
    docx: 'docx',
    pptx: 'pptx',
    txt: 'txt',
    md: 'txt',
    csv: 'txt',
    jpg: 'img',
    jpeg: 'img',
    png: 'img',
    webp: 'img'
  };
  const KNAME = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', txt: 'Text', img: 'Photo' };
  // [value, label, honest note about what you get]
  const TARGETS = {
    pdf: [
      [
        'docx',
        'Word (.docx)',
        'You get the text only. Pictures and the original page layout are not kept.'
      ],
      [
        'txt',
        'Text (.txt)',
        'Plain text from every page. If the PDF is a scan, the words are read with OCR.'
      ],
      ['jpg', 'JPG pictures', 'One picture for each page.']
    ],
    docx: [
      ['pdf', 'PDF', 'Text and headings only. Pictures and tables become plain text.'],
      ['txt', 'Text (.txt)', 'All the text from your document.']
    ],
    pptx: [
      ['txt', 'Text (.txt)', 'All the text from every slide, in order.'],
      ['docx', 'Word (.docx)', 'One section for each slide, with its title and bullets.'],
      ['pdf', 'PDF', 'One page for each slide, with its text. Pictures are not kept.']
    ],
    txt: [
      ['docx', 'Word (.docx)', 'Each line becomes a paragraph.'],
      ['pdf', 'PDF', 'A clean, readable PDF of your text.']
    ],
    img: [
      ['pdf', 'PDF', 'Every photo you choose becomes one page of a single PDF.'],
      [
        'txt',
        'Text (.txt)',
        'Reads the words in the photo (OCR). Works best on clear, straight photos.'
      ],
      ['jpg', 'JPG', 'A JPG copy of each photo.'],
      ['png', 'PNG', 'A PNG copy of each photo.']
    ]
  };

  let files = [],
    kind = null,
    target = null,
    busy = false;
  const msg = (t, k) => {
    const m = $('#fc-msg');
    m.textContent = t;
    m.dataset.k = k || '';
  };
  const bar = p => {
    $('#fc-bar').style.width = p + '%';
  };
  const tick = () => new Promise(r => setTimeout(r, 20));

  // ---------- small writers ----------
  const xml = s =>
    String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const docToTxt = doc =>
    doc.sections
      .map(sec => {
        const lines = [];
        if (sec.label) lines.push(sec.label + ':');
        sec.blocks.forEach(b => lines.push(b.t === 'li' ? '• ' + b.text : b.text));
        return lines.join('\n');
      })
      .join('\n\n')
      .replace(/\n{4,}/g, '\n\n\n');

  const docToDocx = async doc => {
    await Lib.jszip();
    const run = t =>
      String(t)
        .split('\n')
        .map(
          (l, i) =>
            (i ? '<w:r><w:br/></w:r>' : '') +
            l
              .split('\t')
              .map(
                (x, j) =>
                  (j ? '<w:r><w:tab/></w:r>' : '') +
                  (x ? '<w:r><w:t xml:space="preserve">' + xml(x) + '</w:t></w:r>' : '')
              )
              .join('')
        )
        .join('');
    const para = (t, style, extra) =>
      '<w:p><w:pPr>' +
      (style ? '<w:pStyle w:val="' + style + '"/>' : '') +
      (extra || '') +
      '</w:pPr>' +
      run(t) +
      '</w:p>';
    let body = '';
    doc.sections.forEach((sec, i) => {
      if (i > 0) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (sec.label && !sec.blocks.some(b => b.t === 'h')) body += para(sec.label, 'Heading1');
      sec.blocks.forEach(b => {
        if (b.t === 'h') body += para(b.text, 'Heading1');
        else if (b.t === 'li')
          body += para(
            '•\t' + b.text,
            '',
            '<w:ind w:left="540" w:hanging="360"/><w:spacing w:after="60"/>'
          );
        else body += para(b.text, '');
      });
    });
    if (!body) body = para('', '');
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const z = new JSZip();
    z.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
    );
    z.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    z.file(
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    );
    z.file(
      'word/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' +
        W +
        '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style></w:styles>'
    );
    z.file(
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' +
        W +
        '><w:body>' +
        body +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>'
    );
    return z.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  };

  // --- a tiny PDF writer (plain text pages and photo pages) ---
  class Pdf {
    constructor() {
      this.parts = [];
      this.len = 0;
      this.offs = [];
      this.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    }
    push(x) {
      const u = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x;
      this.parts.push(u);
      this.len += u.length;
    }
    obj(id, dict, stream) {
      this.offs[id] = this.len;
      this.push(id + ' 0 obj\n');
      if (stream) {
        this.push(dict.replace(/>>$/, '/Length ' + stream.length + '>>') + '\nstream\n');
        this.push(stream);
        this.push('\nendstream\nendobj\n');
      } else this.push(dict + '\nendobj\n');
    }
    finish(root) {
      const x = this.len,
        n = this.offs.length;
      let t = 'xref\n0 ' + n + '\n0000000000 65535 f \n';
      for (let i = 1; i < n; i++) t += String(this.offs[i]).padStart(10, '0') + ' 00000 n \n';
      t += 'trailer\n<</Size ' + n + '/Root ' + root + ' 0 R>>\nstartxref\n' + x + '\n%%EOF';
      this.push(t);
      return new Blob(this.parts, { type: 'application/pdf' });
    }
  }
  const WIN = {
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x2026: 0x85,
    0x20ac: 0x80,
    0x2122: 0x99,
    0x00a0: 0x20
  };
  let lossy = 0;
  const winAnsi = s => {
    let o = '';
    for (const ch of String(s)) {
      let c = ch.codePointAt(0);
      if (WIN[c]) c = WIN[c];
      else if (c < 32) c = 32;
      else if (c > 255) {
        c = 63;
        lossy++;
      }
      o +=
        c === 40 || c === 41 || c === 92
          ? '\\' + ch
          : c > 126
            ? '\\' + c.toString(8).padStart(3, '0')
            : String.fromCharCode(c);
    }
    return o;
  };
  const wrapPdf = (g, text, maxW) => {
    const out = [];
    String(text)
      .split('\n')
      .forEach(par => {
        const words = par.replace(/\t/g, '    ').split(/ +/);
        let cur = '';
        words.forEach(w => {
          const t = cur ? cur + ' ' + w : w;
          if (g.measureText(t).width <= maxW) cur = t;
          else {
            if (cur) out.push(cur);
            cur = w;
            while (g.measureText(cur).width > maxW && cur.length > 1) {
              let k = cur.length - 1;
              while (k > 1 && g.measureText(cur.slice(0, k)).width > maxW) k--;
              out.push(cur.slice(0, k));
              cur = cur.slice(k);
            }
          }
        });
        out.push(cur);
      });
    return out;
  };
  const docToPdf = doc => {
    lossy = 0;
    const PW = 595.28,
      PH = 841.89,
      MG = 56,
      g = document.createElement('canvas').getContext('2d');
    const ST = {
      h: { f: 'F2', s: 17, lh: 23, before: 8, w: 'bold ' },
      p: { f: 'F1', s: 11, lh: 15, before: 0, w: '' },
      li: { f: 'F1', s: 11, lh: 15, before: 0, w: '', ind: 16 }
    };
    const pages = [];
    let cur, y;
    const np = () => {
      cur = [];
      pages.push(cur);
      y = PH - MG;
    };
    doc.sections.forEach((sec, i) => {
      if (i > 0 || !pages.length) np();
      const blocks =
        sec.label && !sec.blocks.some(b => b.t === 'h')
          ? [{ t: 'h', text: sec.label }].concat(sec.blocks)
          : sec.blocks;
      blocks.forEach(b => {
        const st = ST[b.t] || ST.p;
        g.font = st.w + st.s + 'px Arial,Helvetica,sans-serif';
        if (!String(b.text).trim()) {
          y -= st.lh * 0.7;
          return;
        }
        const lines = wrapPdf(g, (b.t === 'li' ? '• ' : '') + b.text, PW - 2 * MG - (st.ind || 0));
        y -= st.before;
        lines.forEach((l, j) => {
          if (y - st.lh < MG) np();
          y -= st.lh;
          cur.push({ x: MG + (st.ind && j ? st.ind + 9 : st.ind || 0), y, f: st.f, s: st.s, t: l });
        });
        y -= b.t === 'h' ? 4 : 5;
      });
    });
    const pdf = new Pdf(),
      ids = [];
    let id = 5;
    pdf.obj(3, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>');
    pdf.obj(4, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>');
    pages.forEach(p => {
      const s = p
        .map(
          l =>
            'BT /' +
            l.f +
            ' ' +
            l.s +
            ' Tf 1 0 0 1 ' +
            l.x.toFixed(2) +
            ' ' +
            l.y.toFixed(2) +
            ' Tm (' +
            winAnsi(l.t) +
            ') Tj ET'
        )
        .join('\n');
      const cid = id++,
        pid = id++;
      ids.push(pid);
      pdf.obj(
        cid,
        '<<>>',
        Uint8Array.from(s, c => c.charCodeAt(0) & 255)
      );
      pdf.obj(
        pid,
        '<</Type/Page/Parent 2 0 R/MediaBox [0 0 ' +
          PW +
          ' ' +
          PH +
          ']/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ' +
          cid +
          ' 0 R>>'
      );
    });
    pdf.obj(
      2,
      '<</Type/Pages/Kids [' + ids.map(i => i + ' 0 R').join(' ') + ']/Count ' + ids.length + '>>'
    );
    pdf.obj(1, '<</Type/Catalog/Pages 2 0 R>>');
    return pdf.finish(1);
  };
  const canvasBlob = (c, type, q) => new Promise(ok => c.toBlob(ok, type, q));
  const imagesToPdf = async canvases => {
    const pdf = new Pdf(),
      ids = [];
    let id = 3;
    for (const c of canvases) {
      const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
      const k = 842 / Math.max(c.width, c.height),
        w = (c.width * k).toFixed(2),
        h = (c.height * k).toFixed(2);
      const im = id++,
        ct = id++,
        pg = id++;
      ids.push(pg);
      pdf.obj(
        im,
        '<</Type/XObject/Subtype/Image/Width ' +
          c.width +
          '/Height ' +
          c.height +
          '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode>>',
        jpg
      );
      pdf.obj(
        ct,
        '<<>>',
        Uint8Array.from('q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q', c => c.charCodeAt(0) & 255)
      );
      pdf.obj(
        pg,
        '<</Type/Page/Parent 2 0 R/MediaBox [0 0 ' +
          w +
          ' ' +
          h +
          ']/Resources<</XObject<</Im0 ' +
          im +
          ' 0 R>>>>/Contents ' +
          ct +
          ' 0 R>>'
      );
    }
    pdf.obj(
      2,
      '<</Type/Pages/Kids [' + ids.map(i => i + ' 0 R').join(' ') + ']/Count ' + ids.length + '>>'
    );
    pdf.obj(1, '<</Type/Catalog/Pages 2 0 R>>');
    return pdf.finish(1);
  };

  // ---------- readers ----------
  const readTxt = async f => ({
    sections: [
      {
        blocks: (await f.text())
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .map(t => ({ t: 'p', text: t }))
      }
    ]
  });

  const parseXml = s => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (el, name) => Array.from(el.getElementsByTagName(name));
  const readDocx = async f => {
    await Lib.jszip();
    const z = await JSZip.loadAsync(await f.arrayBuffer());
    const part = z.file('word/document.xml');
    if (!part) throw new Error('This does not look like a Word (.docx) file.');
    const d = parseXml(await part.async('string')),
      body = d.getElementsByTagName('w:body')[0],
      blocks = [];
    const ptext = p => {
      let t = '';
      kids(p, '*').forEach(n => {
        const k = n.nodeName;
        if (k === 'w:t') t += n.textContent;
        else if (k === 'w:tab') t += '\t';
        else if (k === 'w:br' || k === 'w:cr') t += '\n';
      });
      return t;
    };
    Array.from(body.children).forEach(n => {
      if (n.nodeName === 'w:p') {
        const st =
          (kids(n, 'w:pStyle')[0] || { getAttribute: () => '' }).getAttribute('w:val') || '';
        const t = ptext(n);
        blocks.push({
          t:
            /^(Heading|Title)/i.test(st) && t.trim()
              ? 'h'
              : kids(n, 'w:numPr').length && t.trim()
                ? 'li'
                : 'p',
          text: t
        });
      } else if (n.nodeName === 'w:tbl') {
        kids(n, 'w:tr').forEach(r =>
          blocks.push({
            t: 'p',
            text: kids(r, 'w:tc')
              .map(c => kids(c, 'w:p').map(ptext).join(' ').trim())
              .join('\t')
          })
        );
      }
    });
    return { sections: [{ blocks }] };
  };
  const readPptx = async f => {
    await Lib.jszip();
    const z = await JSZip.loadAsync(await f.arrayBuffer());
    const names = Object.keys(z.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    if (!names.length) throw new Error('This does not look like a PowerPoint (.pptx) file.');
    const sections = [];
    for (let i = 0; i < names.length; i++) {
      const d = parseXml(await z.file(names[i]).async('string')),
        blocks = [];
      kids(d, 'a:p').forEach(p => {
        let t = '';
        kids(p, '*').forEach(n => {
          if (n.nodeName === 'a:t') t += n.textContent;
          else if (n.nodeName === 'a:br') t += ' ';
        });
        t = t.trim();
        if (!t) return;
        let isTitle = false,
          a = p.parentNode;
        while (a && a.nodeName !== 'p:sp') a = a.parentNode;
        if (a) {
          const ph = kids(a, 'p:ph')[0];
          isTitle = !!ph && /^(title|ctrTitle)$/.test(ph.getAttribute('type') || '');
        }
        blocks.push({ t: isTitle ? 'h' : 'li', text: t });
      });
      sections.push({ label: 'Slide ' + (i + 1), blocks });
      bar(Math.round(((i + 1) / names.length) * 60));
    }
    return { sections };
  };

  // PDF text: group the pieces into lines, then lines into paragraphs
  const pdfPageText = async page => {
    const tc = await page.getTextContent(),
      items = tc.items.filter(it => it.str !== undefined && it.transform);
    const rows = [];
    items.forEach(it => {
      const y = it.transform[5],
        h = Math.abs(it.transform[3]) || it.height || 10;
      let r = rows.find(r => Math.abs(r.y - y) < Math.max(2, h * 0.45));
      if (!r) {
        r = { y, h, its: [] };
        rows.push(r);
      }
      r.its.push({ x: it.transform[4], w: it.width || 0, s: it.str, h });
    });
    rows.sort((a, b) => b.y - a.y);
    const lines = rows
      .map(r => {
        r.its.sort((a, b) => a.x - b.x);
        let s = '',
          end = null;
        r.its.forEach(it => {
          if (end !== null && it.x - end > it.h * 0.18 && !/\s$/.test(s) && !/^\s/.test(it.s))
            s += ' ';
          s += it.s;
          end = it.x + it.w;
        });
        return { y: r.y, h: r.h, s: s.replace(/\s+$/, '') };
      })
      .filter(l => l.s.trim());
    const gaps = [];
    for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
    gaps.sort((a, b) => a - b);
    const lh = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
    const paras = [];
    let cur = '';
    lines.forEach((l, i) => {
      const gap = i ? lines[i - 1].y - l.y : 0;
      if (i && gap > lh * 1.55 && cur) {
        paras.push(cur);
        cur = '';
      }
      cur = cur
        ? /-$/.test(cur) && /^[a-z]/.test(l.s)
          ? cur.slice(0, -1) + l.s
          : cur + ' ' + l.s
        : l.s;
    });
    if (cur) paras.push(cur);
    return paras;
  };
  const ocrCanvas = async (c, i, n) => {
    const img = Lib.prep(c, 'gray');
    return Lib.ocr(img, {
      psm: 3,
      onProgress: p => {
        bar(Math.round(((i + p) / n) * 100));
      }
    });
  };
  const readPdf = async f => {
    const pdf = await Lib.openPdf(f),
      n = pdf.numPages,
      sections = [];
    let chars = 0;
    for (let i = 1; i <= n; i++) {
      const paras = await pdfPageText(await pdf.getPage(i));
      chars += paras.join('').length;
      sections.push({ blocks: paras.map(t => ({ t: 'p', text: t })) });
      bar(Math.round((i / n) * 50));
      msg('Reading page ' + i + ' of ' + n + '…');
      if (i % 4 === 0) await tick();
    }
    if (chars < 25 * n) {
      // looks like a scan: read the pictures with OCR
      const lim = Math.min(n, 15);
      msg(
        'This PDF looks like a scan, so I am reading the words with OCR. This can take a minute…'
      );
      sections.length = 0;
      for (let i = 1; i <= lim; i++) {
        msg('Reading page ' + i + ' of ' + lim + ' with OCR…');
        const c = await Lib.pdfPageToCanvas(pdf, i, 1800),
          t = await ocrCanvas(c, i - 1, lim);
        sections.push({
          blocks: t
            .split(/\n\s*\n/)
            .map(x => x.replace(/\s*\n\s*/g, ' ').trim())
            .filter(Boolean)
            .map(x => ({ t: 'p', text: x }))
        });
      }
      doc_note =
        (n > lim ? 'Only the first ' + lim + ' pages were read with OCR. ' : '') +
        'OCR can misread letters, so please proofread.';
    }
    return { sections };
  };
  let doc_note = '';

  // ---------- running a conversion ----------
  const NAME = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    png: 'image/png'
  };
  const convert = async () => {
    const f = files[0],
      out = [];
    doc_note = '';
    lossy = 0;
    if (kind === 'img') {
      const cs = [];
      for (let i = 0; i < files.length; i++) {
        msg('Opening photo ' + (i + 1) + ' of ' + files.length + '…');
        cs.push(await Lib.fileToCanvas(files[i], 3000));
        bar(Math.round(((i + 1) / files.length) * 30));
      }
      if (target === 'pdf') {
        out.push({
          name: (files.length > 1 ? 'combined-photos' : base(f.name)) + '.pdf',
          blob: await imagesToPdf(cs)
        });
      } else if (target === 'txt') {
        let t = [];
        msg('Reading the words in your photo… (the first time loads the reader)');
        for (let i = 0; i < cs.length; i++) t.push(await ocrCanvas(cs[i], i, cs.length));
        doc_note = 'OCR can misread letters, so please proofread.';
        out.push({
          name: (files.length > 1 ? 'photos-text' : base(f.name)) + '.txt',
          blob: new Blob([t.map(x => x.trim()).join('\n\n')], { type: NAME.txt }),
          text: t.join('\n\n')
        });
      } else {
        for (let i = 0; i < cs.length; i++) {
          const b = await canvasBlob(cs[i], NAME[target], 0.92);
          out.push({ name: base(files[i].name) + '.' + target, blob: b, img: true });
        }
      }
      return out;
    }
    if (kind === 'pdf' && target === 'jpg') {
      const pdf = await Lib.openPdf(f),
        n = Math.min(pdf.numPages, 60);
      for (let i = 1; i <= n; i++) {
        msg('Making picture ' + i + ' of ' + n + '…');
        const c = await Lib.pdfPageToCanvas(pdf, i, 1654),
          b = await canvasBlob(c, 'image/jpeg', 0.92);
        out.push({
          name: base(f.name) + (n > 1 ? '-page-' + String(i).padStart(2, '0') : '') + '.jpg',
          blob: b,
          img: true
        });
        bar(Math.round((i / n) * 100));
      }
      if (pdf.numPages > n) doc_note = 'Only the first 60 pages were converted.';
      return out;
    }
    msg('Reading your file…');
    bar(5);
    let doc =
      kind === 'pdf'
        ? await readPdf(f)
        : kind === 'docx'
          ? await readDocx(f)
          : kind === 'pptx'
            ? await readPptx(f)
            : await readTxt(f);
    if (!doc.sections.some(s => s.blocks.some(b => String(b.text).trim())))
      throw new Error('I could not find any text in this file.');
    msg('Building your ' + (target === 'docx' ? 'Word' : target.toUpperCase()) + ' file…');
    bar(85);
    await tick();
    if (target === 'txt') {
      const t = docToTxt(doc);
      out.push({ name: base(f.name) + '.txt', blob: new Blob([t], { type: NAME.txt }), text: t });
    } else if (target === 'docx')
      out.push({ name: base(f.name) + '.docx', blob: await docToDocx(doc) });
    else if (target === 'pdf') {
      out.push({ name: base(f.name) + '.pdf', blob: docToPdf(doc) });
      if (lossy)
        doc_note =
          lossy +
          ' character' +
          (lossy === 1 ? '' : 's') +
          ' outside the basic Latin alphabet could not be placed in the PDF and became “?”. Use Word or Text to keep every character.';
    }
    return out;
  };

  // ---------- screen ----------
  const ICON_DL =
    '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m0 12-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
  const emptyOut = () => {
    $('#fc-out').innerHTML =
      '<div class="map"><p class="note" style="margin-top:0">Your converted file will appear here. Here is what you can convert:</p><ul><li><b>PDF</b><span>→ Word, Text, JPG pictures</span></li><li><b>Word</b><span>→ PDF, Text</span></li><li><b>PowerPoint</b><span>→ Text, Word, PDF</span></li><li><b>Text</b><span>→ Word, PDF</span></li><li><b>Photos</b><span>→ PDF, Text, JPG, PNG</span></li></ul></div>';
  };
  const drawFiles = () => {
    const el = $('#fc-files');
    el.innerHTML = files
      .map(
        (f, i) =>
          '<div class="fchip"><span class="ftag">' +
          KNAME[KIND[ext(f.name)]] +
          '</span><span class="fn"><b>' +
          esc(f.name) +
          '</b><small>' +
          Lib.fmtSize(f.size) +
          '</small></span><button type="button" class="ib" data-rm="' +
          i +
          '" aria-label="Remove ' +
          esc(f.name) +
          '">×</button></div>'
      )
      .join('');
    $('#fc-pick').hidden = !!files.length && kind !== 'img';
    $('#fc-step2').hidden = !files.length;
    $('#fc-opts-box').hidden = !files.length;
    if (files.length) {
      const T = TARGETS[kind];
      if (!target || !T.some(t => t[0] === target)) target = T[0][0];
      $('#fc-targets').innerHTML = T.map(
        t =>
          '<button type="button" data-t="' +
          t[0] +
          '" aria-pressed="' +
          (t[0] === target) +
          '" class="' +
          (t[0] === target ? 'sel' : '') +
          '">' +
          t[1] +
          '</button>'
      ).join('');
      $('#fc-hint').textContent = T.find(t => t[0] === target)[2];
    }
    $('#fc-go').disabled = !files.length || busy;
  };
  const setFiles = list => {
    list = Array.from(list);
    if (!list.length) return;
    const first = list[0],
      k = KIND[ext(first.name)];
    if (!k) {
      const e = ext(first.name);
      msg(
        e === 'doc' || e === 'ppt'
          ? 'Old .' +
              e +
              ' files are not supported. Open it, choose Save As, and pick .' +
              e +
              'x, then try again.'
          : 'I cannot convert .' +
              (e || 'this') +
              ' files yet. Try PDF, Word (.docx), PowerPoint (.pptx), Text, or a photo.',
        'warn'
      );
      return;
    }
    let use = [first];
    if (k === 'img') {
      use = list.filter(x => KIND[ext(x.name)] === 'img');
      if (use.length < list.length)
        msg('Only the photos were kept. Other file types cannot be mixed with photos.', 'warn');
    } else if (list.length > 1)
      msg('One document at a time, so I kept “' + first.name + '”.', 'warn');
    else msg('');
    files = k === 'img' && kind === 'img' ? files.concat(use) : use;
    kind = k;
    target = null;
    if (files.length > 20) files.length = 20;
    $('#fc-out-title').innerHTML = '<b class="sn out">✓</b><span>Your result</span>';
    emptyOut();
    bar(0);
    drawFiles();
  };
  $('#fc-file').onchange = e => {
    setFiles(e.target.files);
    e.target.value = '';
  };
  const dz = $('#fc-dz');
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
  dz.addEventListener('drop', e => setFiles(e.dataTransfer.files));
  $('#fc-files').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    files.splice(+b.dataset.rm, 1);
    if (!files.length) {
      kind = null;
      target = null;
      msg('');
      emptyOut();
    }
    drawFiles();
  });
  $('#fc-targets').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    target = b.dataset.t;
    drawFiles();
  });

  const showOut = out => {
    const el = $('#fc-out');
    const zipBtn =
      out.length > 1
        ? '<button type="button" class="btn-primary" id="fc-zip">' +
          ICON_DL +
          'Download all (' +
          out.length +
          ') as .zip</button>'
        : '';
    el.innerHTML =
      (doc_note ? '<p class="warn ok-note">' + esc(doc_note) + '</p>' : '') +
      zipBtn +
      '<div class="reslist">' +
      out
        .map(
          (o, i) =>
            '<div class="res">' +
            (o.img
              ? '<img class="thumb" alt="" src="' + URL.createObjectURL(o.blob) + '">'
              : '<span class="ftag big">' +
                esc(o.name.split('.').pop().toUpperCase()) +
                '</span>') +
            '<span class="fn"><b>' +
            esc(o.name) +
            '</b><small>' +
            Lib.fmtSize(o.blob.size) +
            '</small></span><button type="button" class="btn-primary sm" data-dl="' +
            i +
            '">' +
            ICON_DL +
            'Download</button></div>'
        )
        .join('') +
      '</div>' +
      (out[0].text
        ? '<p class="lb" style="margin-top:1.2rem">Preview</p><pre class="prev">' +
          esc(out[0].text.slice(0, 1500)) +
          (out[0].text.length > 1500 ? '\n…' : '') +
          '</pre>'
        : '') +
      '<button type="button" class="ghost" id="fc-again" style="margin-top:1rem">Convert another file</button>';
    el.onclick = async e => {
      const d = e.target.closest('[data-dl]');
      if (d) Lib.download(out[+d.dataset.dl].blob, out[+d.dataset.dl].name);
      if (e.target.closest('#fc-zip')) {
        await Lib.jszip();
        const z = new JSZip();
        out.forEach(o => z.file(o.name, o.blob));
        Lib.download(
          await z.generateAsync({ type: 'blob' }),
          base(files[0].name) + '-converted.zip'
        );
      }
      if (e.target.closest('#fc-again')) {
        files = [];
        kind = null;
        target = null;
        msg('');
        bar(0);
        emptyOut();
        drawFiles();
        window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
      }
    };
  };
  $('#fc-go').onclick = async () => {
    if (busy || !files.length) return;
    busy = true;
    drawFiles();
    bar(3);
    msg('Starting…');
    $('#fc-out').innerHTML = '<p class="empty">Working on it…</p>';
    try {
      const out = await convert();
      bar(100);
      showOut(out);
      msg('Done. Your file is ready.', 'ok');
      if (matchMedia('(max-width:48rem)').matches)
        $('#fc-out').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      bar(0);
      emptyOut();
      const n = (e && e.name) || '';
      msg(
        n === 'PasswordException'
          ? 'This PDF is locked with a password. Unlock it first, then try again.'
          : (e && e.message) || 'Something went wrong. Please try a different file.',
        'warn'
      );
    }
    busy = false;
    drawFiles();
  };
  window.FC = { docToDocx, docToPdf, docToTxt, imagesToPdf };
  emptyOut();
  drawFiles();
})();
