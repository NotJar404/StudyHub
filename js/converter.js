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
        'Keeps the layout, pictures, tables and text styles as closely as possible, and you can still edit the text.'
      ],
      [
        'txt',
        'Text (.txt)',
        'Plain text from every page. If the PDF is a scan, the words are read with OCR.'
      ],
      ['jpg', 'JPG pictures', 'One picture for each page.']
    ],
    docx: [
      ['pdf', 'PDF', 'Looks like your Word file, with its fonts, tables and pictures. The text stays searchable.'],
      ['txt', 'Text (.txt)', 'All the text from your document.']
    ],
    pptx: [
      ['pdf', 'PDF', 'One page for each slide, looking just like your slides. The text stays searchable.'],
      ['docx', 'Word (.docx)', 'One page for each slide. The text stays editable in Word, and pictures and charts look just like the slide.'],
      ['txt', 'Text (.txt)', 'All the text from every slide, in order.']
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

  const PT = 12700; // EMU per point
  const tw = pt => Math.round(pt * 20); // points to twips
  // =====================================================================
  //  ACCURATE CONVERSIONS: keep the look of the original (layout, pictures, tables, fonts)
  // =====================================================================
  const FONTMAP = [
    [/calibri|carlito/i, 'Calibri'],
    [/cambria|caladea/i, 'Cambria'],
    [/times|tinos|liberation ?serif|nimbus ?rom|dejavu ?serif/i, 'Times New Roman'],
    [/arial|helvetica|arimo|liberation ?sans|nimbus ?sans|dejavu ?sans/i, 'Arial'],
    [/courier|consolas|liberation ?mono|dejavu ?sans ?mono|mono/i, 'Courier New'],
    [/georgia/i, 'Georgia'],
    [/verdana/i, 'Verdana'],
    [/tahoma/i, 'Tahoma'],
    [/trebuchet/i, 'Trebuchet MS'],
    [/garamond/i, 'Garamond'],
    [/segoe/i, 'Segoe UI']
  ];
  const wordFont = (name, fam) => {
    const n = String(name || '').replace(/^[A-Z]{6}\+/, '');
    for (const [re, w] of FONTMAP) if (re.test(n)) return w;
    return /mono/i.test(fam || '') ? 'Courier New' : /serif/i.test(fam || '') && !/sans/i.test(fam || '') ? 'Times New Roman' : 'Arial';
  };

  // ---------- Word (.docx) -> PDF that looks like the Word file ----------
  const FONT_FIX = [
    [/\bcalibri\b/i, '"Calibri","Carlito",sans-serif'],
    [/\bcambria\b/i, '"Cambria","Caladea",serif'],
    [/times new roman/i, '"Times New Roman","Tinos","Liberation Serif",serif'],
    [/\barial\b/i, '"Arial","Arimo","Liberation Sans",sans-serif']
  ];
  const fixFont = v => {
    const first = String(v).split(',')[0];
    for (const [re, to] of FONT_FIX) if (re.test(first)) return to;
    return v;
  };
  // Word draws bullets with the Symbol or Wingdings fonts, which most devices do not have
  const BULLETS = { '\uF0B7': '•', '\uF0A7': '▪', '\uF0D8': '➢', '\uF076': '❖', '\uF0FC': '✓', '\uF0E0': '→', '\uF0A8': '☐', '\uF06E': '■', '\uF0B2': '○' };
  const fixFonts = root => {
    root.querySelectorAll('style').forEach(s => {
      s.textContent = s.textContent
        .replace(/content:\s*"([^"]*)"/g, (m, v) => 'content:"' + v.replace(/[\uF000-\uF0FF]/g, c => BULLETS[c] || '•') + '"')
        .replace(/font-family:\s*(Symbol|Wingdings[^;}]*)/gi, 'font-family:inherit')
        .replace(/font-family:\s*([^;}]+)/gi, (m, v) => 'font-family:' + fixFont(v));
    });
    root.querySelectorAll('[style*="font-family"]').forEach(el => {
      el.style.fontFamily = fixFont(el.style.fontFamily.replace(/["']/g, ''));
    });
  };
  // "Don't add space between paragraphs of the same style" (used by bullet lists)
  const fixContextualSpacing = async (buf, root) => {
    const z = await JSZip.loadAsync(buf),
      part = z.file('word/styles.xml');
    if (!part) return;
    const d = parseXml(await part.async('string')),
      ids = new Set();
    kids(d, 'w:style').forEach(st => {
      if (kids(st, 'w:contextualSpacing').length) ids.add('docx_' + (st.getAttribute('w:styleId') || '').toLowerCase());
    });
    root.querySelectorAll('p').forEach(p => {
      const nx = p.nextElementSibling;
      const c = Array.from(p.classList).find(x => ids.has(x));
      if (c && nx && nx.classList.contains(c)) {
        p.style.marginBottom = '0';
        nx.style.marginTop = '0';
      }
    });
  };
  const imagesReady = root =>
    Promise.all(
      Array.from(root.querySelectorAll('img')).map(i =>
        i.complete ? 0 : new Promise(r => ((i.onload = i.onerror = r), setTimeout(r, 4000)))
      )
    );
  // an invisible text layer on top of the picture, so the PDF can still be searched and copied
  // characters the PDF's standard fonts can not write are turned into plain ones the reader understands
  const plainChars = s =>
    s
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
      .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/[\u2022\u25AA\u25E6\u2023\u2043\u25CF\u25CB\u25A0\u2219\u00B7\uF0B7\uF0A7]/g, '-')
      .replace(/[\u2192\u279C\u27A2]/g, '->')
      .replace(/[\u2713\u2714\u2611]/g, 'x')
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
  // the four fonts a PDF always has, chosen to match the look of the original text
  const pdfFontOf = cs => {
    const fam = String(cs.fontFamily || '').toLowerCase(),
      serif = /times|georgia|cambria|garamond|caladea|tinos|serif/.test(fam) && !/sans/.test(fam),
      mono = /courier|consolas|mono/.test(fam),
      bold = +cs.fontWeight >= 600 || cs.fontWeight === 'bold',
      ital = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
    const family = mono ? 'courier' : serif ? 'times' : 'helvetica';
    return { family, style: bold && ital ? 'bolditalic' : bold ? 'bold' : ital ? 'italic' : 'normal' };
  };
  const addHiddenText = (pdf, el, k, y0, y1, off = 0) => {
    const D = el.ownerDocument,
      win = D.defaultView,
      o = el.getBoundingClientRect(),
      walker = D.createTreeWalker(el, NodeFilter.SHOW_TEXT),
      rg = D.createRange();
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue;
      if (!t.trim()) continue;
      const font = pdfFontOf(win.getComputedStyle(n.parentElement || el)),
        re = /\S+/g;
      let m,
        line = null;
      const flush = () => {
        if (!line) return;
        const top = line.y - o.top;
        if (top >= y0 - 1 && top < y1) {
          try {
            pdf.setFont(line.font.family, line.font.style);
            pdf.setFontSize(Math.max(4, line.h * k * 0.8));
            pdf.text(plainChars(line.s), (line.x - o.left) * k, (top - y0 + off + line.h * 0.78) * k, { renderingMode: 'invisible' });
          } catch (e) {}
        }
        line = null;
      };
      while ((m = re.exec(t))) {
        rg.setStart(n, m.index);
        rg.setEnd(n, m.index + m[0].length);
        const r = rg.getBoundingClientRect();
        if (!r.width) continue;
        const same = line && Math.abs(r.top - line.y) < line.h * 0.5 && r.left >= line.end - 1 && line.font.family === font.family && line.font.style === font.style;
        if (same) {
          line.s += ' ' + m[0];
          line.end = r.right;
        } else {
          flush();
          line = { s: m[0], x: r.left, y: r.top, h: r.height, end: r.right, font };
        }
      }
      flush();
    }
  };
  // the pictures, placed on top of the page picture, so the PDF keeps each one as a real picture
  const addPictures = (pdf, pg, k, y0, y1, off = 0) => {
    const o = pg.getBoundingClientRect();
    pg.querySelectorAll('img').forEach(im => {
      if (!im.src || !im.naturalWidth || !im.getAttribute('src') || im.getAttribute('src').indexOf('data:') !== 0) return;
      const r = im.getBoundingClientRect(),
        top = r.top - o.top;
      if (!r.width || !r.height || top < y0 - 1 || top >= y1) return;
      try {
        pdf.addImage(im.getAttribute('src'), 'PNG', (r.left - o.left) * k, (top - y0 + off) * k, r.width * k, r.height * k, undefined, 'FAST');
      } catch (e) {
        try {
          pdf.addImage(im.getAttribute('src'), 'JPEG', (r.left - o.left) * k, (top - y0 + off) * k, r.width * k, r.height * k, undefined, 'FAST');
        } catch (e2) {}
      }
    });
  };
  // where to cut a tall picture into pages: the emptiest row just above the page edge
  const cutRow = (c, target) => {
    const from = Math.max(1, Math.floor(target - 140)),
      g = c.getContext('2d'),
      h = Math.min(140, c.height - from);
    if (h <= 1) return Math.min(c.height, Math.round(target));
    const d = g.getImageData(0, from, c.width, h).data;
    let best = h - 1,
      bestInk = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      let ink = 0;
      for (let x = 0; x < c.width; x += 4) {
        const i = (y * c.width + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] < 720) ink++;
      }
      if (ink < bestInk) {
        bestInk = ink;
        best = y;
        if (!ink) break;
      }
    }
    return from + best;
  };
  // ---- floating pictures and text boxes: drawn by us, because the Word drawing library places them badly ----
  const NSURI = {
    w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
  };
  const nsAll = (el, ns, name) => Array.from(el.getElementsByTagNameNS(NSURI[ns], name));
  const ns1 = (el, ns, name) => (el.getElementsByTagNameNS(NSURI[ns], name) || [])[0] || null;
  const wAttr = (el, name) => (el ? el.getAttributeNS(NSURI.w, name) || el.getAttribute('w:' + name) : null);
  const b64 = u8 => {
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  };
  // custom tab stops: the Word drawing library ignores them, so each tab becomes a marker we size ourselves
  const markTabs = doc => {
    nsAll(doc, 'w', 'p').forEach(p => {
      const ppr = Array.from(p.children).find(e => e.localName === 'pPr'),
        tabs = ppr ? nsAll(ppr, 'w', 'tab').map(x => +wAttr(x, 'pos')).filter(Boolean) : [];
      if (!tabs.length) return;
      let k = 0;
      nsAll(p, 'w', 'tab')
        .filter(x => x.parentNode.localName === 'r')
        .forEach(x => {
          const pos = tabs[Math.min(k++, tabs.length - 1)],
            tt = doc.createElementNS(NSURI.w, 'w:t');
          tt.setAttribute('xml:space', 'preserve');
          tt.textContent = '\u27E6T' + ((pos / 20) * (96 / 72)).toFixed(2) + '\u27E7';
          x.parentNode.replaceChild(tt, x);
        });
    });
  };
  // page-number fields: remember them so every page shows its own number
  const markPages = doc => {
    nsAll(doc, 'w', 'instrText').forEach(it => {
      if (!/^\s*PAGE\b/i.test(it.textContent)) return;
      let r = it.parentNode.nextSibling,
        seen = false;
      while (r) {
        const fc = r.localName === 'r' && ns1(r, 'w', 'fldChar');
        if (fc && wAttr(fc, 'fldCharType') === 'separate') seen = true;
        else if (fc && wAttr(fc, 'fldCharType') === 'end') break;
        else if (seen && r.localName === 'r' && ns1(r, 'w', 't')) ns1(r, 'w', 't').textContent = '\u27E6PAGE\u27E7';
        r = r.nextSibling;
      }
    });
  };
  const prepareDocx = async buf => {
    const z = await JSZip.loadAsync(buf),
      part = z.file('word/document.xml'),
      anchors = [];
    if (!part) return { buf, anchors };
    const doc = new DOMParser().parseFromString(await part.async('string'), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { buf, anchors };
    const mar = nsAll(doc, 'w', 'pgMar').pop(),
      footerPx = mar && wAttr(mar, 'footer') ? (+wAttr(mar, 'footer') / 20) * (96 / 72) : null;
    const rels = {},
      rp = z.file('word/_rels/document.xml.rels');
    if (rp) new DOMParser().parseFromString(await rp.async('string'), 'application/xml').querySelectorAll('Relationship').forEach(r => (rels[r.getAttribute('Id')] = r.getAttribute('Target')));
    // page breaks written as a paragraph setting become real page breaks
    nsAll(doc, 'w', 'pageBreakBefore').forEach(pb => {
      const ppr = pb.parentNode,
        p = ppr.parentNode;
      if (wAttr(pb, 'val') === '0' || wAttr(pb, 'val') === 'false') return;
      ppr.removeChild(pb);
      const r = doc.createElementNS(NSURI.w, 'w:r'),
        br = doc.createElementNS(NSURI.w, 'w:br');
      br.setAttributeNS(NSURI.w, 'w:type', 'page');
      r.appendChild(br);
      p.insertBefore(r, ppr.nextSibling);
    });
    const emu = el => (el ? +el.textContent || 0 : 0) / 9525;
    for (const an of nsAll(doc, 'wp', 'anchor')) {
      let run = an;
      while (run && !(run.localName === 'r' && run.namespaceURI === NSURI.w)) run = run.parentNode;
      const ext = ns1(an, 'wp', 'extent'),
        ph = ns1(an, 'wp', 'positionH'),
        pv = ns1(an, 'wp', 'positionV');
      if (!run || !ext) continue;
      const item = {
        id: anchors.length,
        w: (+ext.getAttribute('cx') || 0) / 9525,
        h: (+ext.getAttribute('cy') || 0) / 9525,
        relH: ph ? ph.getAttribute('relativeFrom') : 'page',
        relV: pv ? pv.getAttribute('relativeFrom') : 'page',
        x: ph ? emu(ns1(ph, 'wp', 'posOffset')) : 0,
        y: pv ? emu(ns1(pv, 'wp', 'posOffset')) : 0,
        alignH: ph && ns1(ph, 'wp', 'align') ? ns1(ph, 'wp', 'align').textContent : '',
        alignV: pv && ns1(pv, 'wp', 'align') ? ns1(pv, 'wp', 'align').textContent : '',
        behind: an.getAttribute('behindDoc') === '1',
        z: +an.getAttribute('relativeHeight') || 0
      };
      const blip = ns1(an, 'a', 'blip'),
        tx = ns1(an, 'wps', 'txbx');
      if (blip) {
        const rid = blip.getAttributeNS(NSURI.r, 'embed') || blip.getAttribute('r:embed'),
          f = rels[rid] && z.file('word/' + rels[rid].replace(/^\//, '').replace(/^word\//, ''));
        if (!f) continue;
        const ext2 = (rels[rid].split('.').pop() || 'png').toLowerCase();
        item.src = 'data:image/' + (ext2 === 'jpg' ? 'jpeg' : ext2) + ';base64,' + b64(await f.async('uint8array'));
      } else if (tx) {
        item.paras = nsAll(tx, 'w', 'p').map(p => {
          const jc = ns1(p, 'w', 'jc'),
            sp = ns1(p, 'w', 'spacing'),
            ind = ns1(p, 'w', 'ind');
          return {
            align: jc ? wAttr(jc, 'val') : 'left',
            before: sp ? (+wAttr(sp, 'before') || 0) / 20 : 0,
            line: sp && wAttr(sp, 'lineRule') === 'exact' ? (+wAttr(sp, 'line') || 0) / 20 : 0,
            left: ind ? (+wAttr(ind, 'left') || 0) / 20 : 0,
            runs: nsAll(p, 'w', 'r').map(r => {
              const pr = ns1(r, 'w', 'rPr'),
                has = n => !!(pr && ns1(pr, 'w', n) && wAttr(ns1(pr, 'w', n), 'val') !== '0'),
                sz = pr && ns1(pr, 'w', 'sz'),
                col = pr && ns1(pr, 'w', 'color'),
                fo = pr && ns1(pr, 'w', 'rFonts');
              return {
                t: nsAll(r, 'w', 't').map(x => x.textContent).join('') + (ns1(r, 'w', 'tab') ? '\t' : ''),
                b: has('b'),
                i: has('i'),
                sz: sz ? (+wAttr(sz, 'val') || 22) / 2 : 11,
                col: col && wAttr(col, 'val') !== 'auto' ? wAttr(col, 'val') : '',
                font: fo ? wAttr(fo, 'ascii') || '' : ''
              };
            })
          };
        });
      } else continue;
      anchors.push(item);
      const mk = doc.createElementNS(NSURI.w, 'w:r'),
        rpr = doc.createElementNS(NSURI.w, 'w:rPr'),
        sz = doc.createElementNS(NSURI.w, 'w:sz'),
        t = doc.createElementNS(NSURI.w, 'w:t');
      sz.setAttributeNS(NSURI.w, 'w:val', '2');
      rpr.appendChild(sz);
      t.setAttribute('xml:space', 'preserve');
      t.textContent = '\u27E6A' + item.id + '\u27E7';
      mk.appendChild(rpr);
      mk.appendChild(t);
      run.parentNode.replaceChild(mk, run);
    }
    markTabs(doc);
    z.file('word/document.xml', new XMLSerializer().serializeToString(doc));
    for (const name of Object.keys(z.files).filter(n => /^word\/(header|footer)\d*\.xml$/.test(n))) {
      const d2 = new DOMParser().parseFromString(await z.file(name).async('string'), 'application/xml');
      if (d2.getElementsByTagName('parsererror').length) continue;
      markTabs(d2);
      markPages(d2);
      z.file(name, new XMLSerializer().serializeToString(d2));
    }
    return { buf: await z.generateAsync({ type: 'arraybuffer' }), anchors, footerPx };
  };
  const placePageNumbers = (idoc, host) => {
    Array.from(host.querySelectorAll('section.docx')).forEach((sec, i) => {
      const w = idoc.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) if (n.nodeValue.includes('\u27E6PAGE\u27E7')) n.nodeValue = n.nodeValue.replace(/\u27E6PAGE\u27E7/g, String(i + 1));
    });
  };
  const placeTabs = (idoc, host) => {
    const walker = idoc.createTreeWalker(host, NodeFilter.SHOW_TEXT),
      nodes = [];
    let n;
    while ((n = walker.nextNode())) if (/\u27E6T[\d.]+\u27E7/.test(n.nodeValue)) nodes.push(n);
    nodes.forEach(node => {
      const sec = node.parentElement.closest('section.docx');
      if (!sec) return;
      const cs = idoc.defaultView.getComputedStyle(sec),
        left = sec.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0),
        m = node.nodeValue.match(/\u27E6T([\d.]+)\u27E7/),
        i = m.index,
        rg = idoc.createRange();
      rg.setStart(node, i);
      rg.setEnd(node, i + m[0].length);
      const x = rg.getBoundingClientRect().left - left,
        span = idoc.createElement('span');
      span.style.cssText = 'display:inline-block;width:' + Math.max(4, +m[1] - x) + 'px;height:1px';
      rg.deleteContents();
      rg.insertNode(span);
    });
  };
  const placeAnchors = (idoc, host, anchors) => {
    if (!anchors.length) return;
    const walker = idoc.createTreeWalker(host, NodeFilter.SHOW_TEXT),
      marks = {};
    let n;
    while ((n = walker.nextNode())) {
      const m = n.nodeValue.match(/\u27E6A(\d+)\u27E7/);
      if (m) marks[m[1]] = n;
    }
    anchors.forEach(a => {
      const node = marks[a.id];
      if (!node) return;
      const sec = node.parentElement.closest('section.docx');
      if (!sec) return;
      const cs = idoc.defaultView.getComputedStyle(sec),
        rg = idoc.createRange();
      rg.selectNodeContents(node);
      const mr = rg.getBoundingClientRect(),
        sr = sec.getBoundingClientRect(),
        pl = parseFloat(cs.paddingLeft) || 0,
        pr = parseFloat(cs.paddingRight) || 0,
        pt = parseFloat(cs.paddingTop) || 0,
        pb = parseFloat(cs.paddingBottom) || 0,
        W = sr.width,
        H = sr.height;
      node.nodeValue = node.nodeValue.replace(/\u27E6A\d+\u27E7/, '');
      if (cs.position === 'static') sec.style.position = 'relative';
      sec.style.isolation = 'isolate';
      let x = a.x,
        y = a.y;
      const inner = a.relH === 'margin' || a.relH === 'column' || a.relH === 'insideMargin';
      if (a.alignH) x = (inner ? pl : 0) + (a.alignH === 'center' ? ((inner ? W - pl - pr : W) - a.w) / 2 : a.alignH === 'right' ? (inner ? W - pl - pr : W) - a.w : 0);
      else if (inner) x = pl + a.x;
      else if (a.relH === 'character') x = mr.left - sr.left + a.x;
      if (a.alignV) y = (a.relV === 'margin' ? pt : 0) + (a.alignV === 'center' ? ((a.relV === 'margin' ? H - pt - pb : H) - a.h) / 2 : a.alignV === 'bottom' ? (a.relV === 'margin' ? H - pt - pb : H) - a.h : 0);
      else if (a.relV === 'margin' || a.relV === 'topMargin') y = pt + a.y;
      else if (a.relV === 'paragraph' || a.relV === 'line') y = mr.top - sr.top + a.y;
      const el = idoc.createElement(a.src ? 'img' : 'div');
      el.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;padding:0;left:' + x + 'px;top:' + y + 'px;width:' + a.w + 'px;height:' + a.h + 'px;z-index:' + (a.behind ? -1 : 2) + ';';
      if (a.src) el.src = a.src;
      else {
        el.style.overflow = 'visible';
        a.paras.forEach(p => {
          const d = idoc.createElement('div');
          d.style.cssText = 'white-space:pre-wrap;margin:0;padding:0;text-align:' + ({ center: 'center', right: 'right', both: 'justify' }[p.align] || 'left') + ';margin-top:' + (p.before || 0) + 'pt;padding-left:' + (p.left || 0) + 'pt;' + (p.line ? 'line-height:' + p.line + 'pt;' : '');
          p.runs.forEach(r => {
            const s = idoc.createElement('span');
            s.textContent = r.t;
            s.style.cssText = 'font-size:' + r.sz + 'pt;' + (r.b ? 'font-weight:700;' : '') + (r.i ? 'font-style:italic;' : '') + (r.col ? 'color:#' + r.col + ';' : '') + (r.font ? 'font-family:' + fixFont(r.font) + ';' : '');
            d.appendChild(s);
          });
          el.appendChild(d);
        });
      }
      sec.appendChild(el);
    });
  };

  const docxToPdfExact = async f => {
    await Lib.jszip();
    await Promise.all([Lib.docxPreview(), Lib.html2canvas(), Lib.jspdf()]);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:absolute;left:-30000px;top:0;width:1400px;height:1400px;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const idoc = frame.contentDocument;
    idoc.open();
    idoc.write('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;color:#000}</style></head><body></body></html>');
    idoc.close();
    Lib.officeFonts(idoc);
    const host = idoc.createElement('div');
    idoc.body.appendChild(host);
    try {
      const buf = await f.arrayBuffer(),
        prep = await prepareDocx(buf);
      await docx.renderAsync(prep.buf, host, null, {
        inWrapper: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
        ignoreLastRenderedPageBreak: false
      });
      fixFonts(host);
      await fixContextualSpacing(buf, host);
      placeAnchors(idoc, host, prep.anchors);
      // a footer sits the right distance from the bottom edge of the page, as in Word
      if (prep.footerPx !== null)
        host.querySelectorAll('section.docx').forEach(sec => {
          const ft = Array.from(sec.children).find(e => e.tagName === 'FOOTER'),
            cs = idoc.defaultView.getComputedStyle(sec);
          if (!ft) return;
          sec.style.position = 'relative';
          ft.style.cssText = 'position:absolute;margin:0;min-height:0;height:auto;left:' + cs.paddingLeft + ';right:' + cs.paddingRight + ';bottom:' + prep.footerPx + 'px';
        });
      placePageNumbers(idoc, host);
      placeTabs(idoc, host);
      if (idoc.fonts && idoc.fonts.ready) await Promise.race([idoc.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
      await imagesReady(host);
      await tick();
      const pages = Array.from(host.querySelectorAll('section.docx'));
      if (!pages.length) throw new Error('I could not draw this Word file. Is it a normal .docx?');
      const k = 0.75,
        SC = 1.75,
        max = Math.min(pages.length, 60);
      let pdf = null,
        made = 0;
      const put = (c, w, h, y0, y1, pg, off) => {
        const fmt = [w * k, h * k],
          ori = w > h ? 'l' : 'p';
        if (!pdf) pdf = new jspdf.jsPDF({ unit: 'pt', format: fmt, orientation: ori, compress: true });
        else pdf.addPage(fmt, ori);
        pdf.addImage(c.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, w * k, h * k, undefined, 'FAST');
        addPictures(pdf, pg, k, y0, y1, off || 0);
        addHiddenText(pdf, pg, k, y0, y1, off || 0);
        made++;
      };
      for (let i = 0; i < max; i++) {
        msg('Drawing page ' + (i + 1) + ' of ' + max + '…');
        const pg = pages[i],
          w = pg.offsetWidth,
          h = pg.offsetHeight,
          ph = parseFloat(idoc.defaultView.getComputedStyle(pg).minHeight) || h,
          c = await html2canvas(pg, { scale: SC, backgroundColor: '#ffffff', logging: false, useCORS: true });
        if (h <= ph * 1.01) put(c, w, h, 0, h, pg);
        else if (h <= ph * 1.1) {
          // a little too tall: shrink it a touch so it fits one page of the right size
          const s = ph / h,
            o = document.createElement('canvas');
          o.width = Math.round(w * SC);
          o.height = Math.round(ph * SC);
          const g = o.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, o.width, o.height);
          g.drawImage(c, (o.width - c.width * s) / 2, 0, c.width * s, o.height);
          if (!pdf) pdf = new jspdf.jsPDF({ unit: 'pt', format: [w * k, ph * k], orientation: w > ph ? 'l' : 'p', compress: true });
          else pdf.addPage([w * k, ph * k], w > ph ? 'l' : 'p');
          pdf.addImage(o.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, w * k, ph * k, undefined, 'FAST');
          made++;
        } else {
          // a long page with no page breaks: cut it into pages at the emptiest rows, keeping the margins
          const cs = idoc.defaultView.getComputedStyle(pg),
            padT = parseFloat(cs.paddingTop) || 72,
            padB = parseFloat(cs.paddingBottom) || 72;
          let y = 0;
          while (y < c.height - 2 && made < 150) {
            const off = y ? padT : 0,
              room = (ph - off - padB) * SC,
              rest = c.height - y,
              cut = rest <= (ph - off) * SC * 1.02 ? c.height : cutRow(c, y + room),
              s = document.createElement('canvas'),
              g = s.getContext('2d');
            s.width = Math.round(w * SC);
            s.height = Math.round(ph * SC);
            g.fillStyle = '#fff';
            g.fillRect(0, 0, s.width, s.height);
            g.drawImage(c, 0, y, c.width, cut - y, 0, off * SC, c.width, cut - y);
            put(s, w, ph, y / SC, cut / SC, pg, off);
            y = cut;
          }
        }
        bar(10 + Math.round(((i + 1) / max) * 85));
        await tick();
      }
      if (pages.length > max) doc_note = 'Only the first ' + max + ' pages were converted.';
      return pdf.output('blob');
    } finally {
      frame.remove();
    }
  };

  // =====================================================================
  //  POWERPOINT: read each slide (shapes, text, pictures, tables, bar charts) and draw it as PowerPoint does
  // =====================================================================
  const EMU = 12700; // EMU per point
  const childOf = (el, name) => (el ? Array.from(el.children).find(c => c.localName === name) || null : null);
  const childrenOf = (el, name) => (el ? Array.from(el.children).filter(c => c.localName === name) : []);
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hexOf = s => (s && /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null);
  const mixWhite = (hex, a) => {
    const n = parseInt(hex, 16),
      r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255,
      mix = v => Math.round(v * a + 255 * (1 - a));
    return [mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const pptOpen = async f => {
    await Lib.jszip();
    const z = await JSZip.loadAsync(await f.arrayBuffer());
    const presPart = z.file('ppt/presentation.xml');
    if (!presPart) throw new Error('I could not open this PowerPoint file. Is it a normal .pptx?');
    const pres = parseXml(await presPart.async('string'));
    const sz = childOf(pres.documentElement, 'sldSz');
    const size = { w: ((sz && +sz.getAttribute('cx')) || 12192000) / EMU, h: ((sz && +sz.getAttribute('cy')) || 6858000) / EMU };
    const readXml = async p => {
      const part = z.file(p);
      return part ? parseXml(await part.async('string')) : null;
    };
    const resolvePath = (dir, t) => {
      if (t.startsWith('/')) return t.slice(1);
      const out = [];
      (dir + t).split('/').forEach(p => {
        if (p === '..') out.pop();
        else if (p && p !== '.') out.push(p);
      });
      return out.join('/');
    };
    const relsOf = async path => {
      const dir = path.replace(/[^/]+$/, ''),
        name = path.replace(/^.*\//, ''),
        d = await readXml(dir + '_rels/' + name + '.rels'),
        map = {};
      if (d) childrenOf(d.documentElement, 'Relationship').forEach(r => (map[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: resolvePath(dir, r.getAttribute('Target') || '') }));
      return map;
    };
    // theme: colours and fonts
    const theme = { colors: {}, fonts: { major: 'Calibri Light', minor: 'Calibri' }, accents: [] };
    const th = await readXml('ppt/theme/theme1.xml');
    if (th) {
      const cs = th.getElementsByTagName('a:clrScheme')[0];
      if (cs) Array.from(cs.children).forEach(c => {
        const v = c.firstElementChild;
        if (v) theme.colors[c.localName] = hexOf(v.getAttribute('val')) || hexOf(v.getAttribute('lastClr')) || '000000';
      });
      theme.accents = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map(k => theme.colors[k] || '4472C4');
      const fs = th.getElementsByTagName('a:fontScheme')[0];
      if (fs) {
        const mj = fs.getElementsByTagName('a:majorFont')[0],
          mn = fs.getElementsByTagName('a:minorFont')[0];
        if (mj && childOf(mj, 'latin')) theme.fonts.major = childOf(mj, 'latin').getAttribute('typeface') || theme.fonts.major;
        if (mn && childOf(mn, 'latin')) theme.fonts.minor = childOf(mn, 'latin').getAttribute('typeface') || theme.fonts.minor;
      }
    }
    const schemeHex = n => {
      const map = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
      return theme.colors[map[n] || n] || null;
    };
    const colorOf = node => {
      if (!node) return null;
      const s = node.getElementsByTagName('a:srgbClr')[0],
        sc = node.getElementsByTagName('a:schemeClr')[0];
      if (s) return hexOf(s.getAttribute('val'));
      if (sc) return schemeHex(sc.getAttribute('val'));
      return null;
    };
    const fontOf = name => {
      if (!name) return null;
      if (name === '+mn-lt') return theme.fonts.minor;
      if (name === '+mj-lt') return theme.fonts.major;
      return name;
    };
    // paragraph and character properties
    const rprOf = r => {
      const o = {};
      if (r.hasAttribute('sz')) o.sz = +r.getAttribute('sz') / 100;
      if (r.hasAttribute('b')) o.b = r.getAttribute('b') === '1' || r.getAttribute('b') === 'true';
      if (r.hasAttribute('i')) o.i = r.getAttribute('i') === '1' || r.getAttribute('i') === 'true';
      const sf = childOf(r, 'solidFill');
      if (sf) o.color = colorOf(sf);
      const lt = childOf(r, 'latin');
      if (lt) o.font = fontOf(lt.getAttribute('typeface'));
      return o;
    };
    const pprOf = p => {
      const o = {};
      if (!p) return o;
      if (p.hasAttribute('marL')) o.marL = +p.getAttribute('marL') / EMU;
      if (p.hasAttribute('indent')) o.indent = +p.getAttribute('indent') / EMU;
      if (p.hasAttribute('algn')) o.algn = p.getAttribute('algn');
      const ls = childOf(p, 'lnSpc');
      if (ls && childOf(ls, 'spcPct')) o.lnPct = (+childOf(ls, 'spcPct').getAttribute('val') || 100000) / 100000;
      if (ls && childOf(ls, 'spcPts')) o.lnPt = (+childOf(ls, 'spcPts').getAttribute('val') || 0) / 100;
      const sb = childOf(p, 'spcBef');
      if (sb && childOf(sb, 'spcPts')) o.before = (+childOf(sb, 'spcPts').getAttribute('val') || 0) / 100;
      const bc = childOf(p, 'buChar');
      if (bc) o.bu = bc.getAttribute('char');
      if (childOf(p, 'buNone')) o.bu = '';
      const dr = childOf(p, 'defRPr');
      if (dr) o.rpr = rprOf(dr);
      return o;
    };
    const lvlChild = (el, lvl) => (el ? childOf(el, 'lvl' + (lvl + 1) + 'pPr') : null);
    // placeholders
    const phOf = el => {
      const nv = childOf(el, 'nvSpPr') || childOf(el, 'nvPicPr') || childOf(el, 'nvGraphicFramePr');
      const ph = nv && childOf(childOf(nv, 'nvPr'), 'ph');
      return ph ? { type: ph.getAttribute('type') || 'obj', idx: ph.getAttribute('idx') } : null;
    };
    const findPh = (tree, ph) => {
      if (!tree || !ph) return null;
      return Array.from(tree.getElementsByTagName('p:sp')).find(s => {
        const q = phOf(s);
        if (!q) return false;
        if (ph.idx && q.idx) return q.idx === ph.idx;
        return q.type === ph.type && ph.type !== 'obj';
      }) || null;
    };
    const boxOf = xf => {
      if (!xf) return null;
      const off = childOf(xf, 'off'),
        ext = childOf(xf, 'ext');
      if (!off || !ext) return null;
      return { x: +off.getAttribute('x') / EMU, y: +off.getAttribute('y') / EMU, w: +ext.getAttribute('cx') / EMU, h: +ext.getAttribute('cy') / EMU };
    };
    const applyT = (T, b) => (b ? { x: T.ax + (b.x - T.cx) * T.sx, y: T.ay + (b.y - T.cy) * T.sy, w: b.w * T.sx, h: b.h * T.sy } : null);
    const IDT = { ax: 0, ay: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
    // master text styles
    const masterOf = async layoutPath => {
      const lr = await relsOf(layoutPath);
      const mp = Object.values(lr).find(r => /slideMaster/.test(r.type));
      return mp ? { path: mp.target, xml: await readXml(mp.target), rels: await relsOf(mp.target) } : null;
    };
    const cache = {};
    const loadLayout = async layoutPath => {
      if (cache[layoutPath]) return cache[layoutPath];
      const xml = await readXml(layoutPath),
        master = await masterOf(layoutPath);
      return (cache[layoutPath] = { xml, master });
    };
    const pictureSrc = async (rels, rid) => {
      const r = rels[rid];
      if (!r) return null;
      const part = z.file(r.target);
      if (!part) return null;
      const ext = (r.target.split('.').pop() || 'png').toLowerCase(),
        mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
      const u8 = await part.async('uint8array');
      let s = '';
      for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      return { src: 'data:' + mime + ';base64,' + btoa(s), ext: ext === 'jpg' ? 'jpeg' : ext };
    };
    const fillOf = spPr => {
      const sf = childOf(spPr, 'solidFill');
      if (sf) return colorOf(sf);
      if (childOf(spPr, 'noFill')) return 'none';
      const gf = childOf(spPr, 'gradFill');
      if (gf) {
        const gs = gf.getElementsByTagName('a:gs')[0];
        return gs ? colorOf(gs) : null;
      }
      return null;
    };
    const lineOf = spPr => {
      const ln = childOf(spPr, 'ln');
      if (!ln) return null;
      if (childOf(ln, 'noFill')) return { w: 0, c: null };
      const sf = childOf(ln, 'solidFill');
      return { w: (+ln.getAttribute('w') || 12700) / EMU, c: sf ? colorOf(sf) || '000000' : '000000' };
    };
    // turn one text body into paragraphs with final properties
    const textParas = (txBody, kind, lists, master) => {
      const paras = [];
      const mstyle = master ? childOf(master, kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle') : null;
      Array.from(txBody.children).filter(c => c.localName === 'p').forEach(p => {
        const pPr = childOf(p, 'pPr'),
          lvl = pPr && pPr.getAttribute('lvl') ? +pPr.getAttribute('lvl') : 0;
        let pp = { rpr: {} };
        const merge = o => {
          if (!o) return;
          const { rpr, ...rest } = o;
          pp = { ...pp, ...rest, rpr: { ...pp.rpr, ...(rpr || {}) } };
        };
        merge(pprOf(lvlChild(mstyle, lvl)));
        lists.forEach(l => merge(pprOf(lvlChild(l, lvl))));
        merge(pprOf(pPr));
        const runs = [];
        Array.from(p.children).forEach(c => {
          if (c.localName === 'r' || c.localName === 'fld') {
            const t = Array.from(c.getElementsByTagName('a:t')).map(x => x.textContent).join('');
            const rp = { ...pp.rpr, ...rprOf(childOf(c, 'rPr') || c.ownerDocument.createElement('x')) };
            runs.push({ t, sz: rp.sz || 18, b: !!rp.b, i: !!rp.i, color: rp.color || theme.colors.dk1 || '000000', font: rp.font || theme.fonts.minor });
          } else if (c.localName === 'br') runs.push({ t: '\n', sz: pp.rpr.sz || 18, b: false, i: false, color: theme.colors.dk1 || '000000', font: theme.fonts.minor });
        });
        const maxSz = runs.reduce((m, r) => Math.max(m, r.sz), pp.rpr.sz || 18);
        paras.push({
          algn: pp.algn || 'l',
          marL: pp.marL || 0,
          indent: pp.indent || 0,
          before: pp.before || 0,
          lnPct: pp.lnPct || 0,
          lnPt: pp.lnPt || 0,
          bu: pp.bu || '',
          lineH: pp.lnPt ? pp.lnPt : (pp.lnPct || 1) * 1.2 * maxSz,
          runs
        });
      });
      return paras;
    };
    const bodyInsets = txBody => {
      const bp = childOf(txBody, 'bodyPr') || { getAttribute: () => null };
      // "shrink text on overflow": PowerPoint scales the text by fontScale when it saved the file
      const na = childOf(bp, 'normAutofit');
      const fs = na && na.getAttribute('fontScale') ? +na.getAttribute('fontScale') / 100000 : 1;
      const g = (a, d) => (bp.getAttribute && bp.getAttribute(a) != null ? +bp.getAttribute(a) / EMU : d);
      return { l: g('lIns', 7.2), t: g('tIns', 3.6), r: g('rIns', 7.2), b: g('bIns', 3.6), anchor: (bp.getAttribute && bp.getAttribute('anchor')) || 't', scale: fs };
    };
    // one slide -> list of drawable items
    const readSlide = async (slidePath, idx) => {
      const sx = await readXml(slidePath),
        srels = await relsOf(slidePath),
        lp = Object.values(srels).find(r => /slideLayout/.test(r.type)),
        L = lp ? await loadLayout(lp.target) : { xml: null, master: null },
        lrels = lp ? await relsOf(lp.target) : {},
        M = L.master,
        mxml = M ? M.xml : null,
        items = [];
      const root = sx.documentElement,
        cSld = childOf(root, 'cSld');
      // background
      let bg = null;
      const bgFill = node => {
        const bgEl = childOf(node, 'bg');
        const bgPr = bgEl && childOf(bgEl, 'bgPr');
        return bgPr ? fillOf(bgPr) : null;
      };
      bg = bgFill(cSld) || (L.xml && bgFill(childOf(L.xml.documentElement, 'cSld'))) || (mxml && bgFill(childOf(mxml.documentElement, 'cSld'))) || '#FFFFFF';
      // a picture used as the background
      const bgPicOf = async (node, rels) => {
        const bgEl = childOf(node, 'bg'),
          bgPr = bgEl && childOf(bgEl, 'bgPr'),
          bf = bgPr && childOf(bgPr, 'blipFill'),
          blip = bf && bf.getElementsByTagName('a:blip')[0],
          rid = blip && (blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || blip.getAttribute('r:embed'));
        return rid ? pictureSrc(rels, rid) : null;
      };
      let bgImg = await bgPicOf(cSld, srels);
      if (!bgImg && L.xml) bgImg = await bgPicOf(childOf(L.xml.documentElement, 'cSld'), lrels);
      if (!bgImg && mxml && M) bgImg = await bgPicOf(childOf(mxml.documentElement, 'cSld'), M.rels);
      const spTree = childOf(cSld, 'spTree');
      const walk = async (nodes, T, lists, layoutTree, masterTree, rels = srels) => {
        for (const el of Array.from(nodes)) {
          const ln = el.localName;
          if (ln === 'sp') {
            const ph = phOf(el),
              lph = findPh(layoutTree, ph),
              mph = findPh(masterTree, ph);
            const xf = childOf(childOf(el, 'spPr'), 'xfrm') || childOf(childOf(lph, 'spPr'), 'xfrm') || childOf(childOf(mph, 'spPr'), 'xfrm');
            const box = applyT(T, boxOf(xf));
            if (!box) continue;
            const spPr = childOf(el, 'spPr'),
              geomEl = childOf(spPr, 'prstGeom'),
              geom = geomEl ? geomEl.getAttribute('prst') : 'rect',
              fill = fillOf(spPr) || (lph ? fillOf(childOf(lph, 'spPr')) : null),
              line = lineOf(spPr) || (lph ? lineOf(childOf(lph, 'spPr')) : null);
            const txBody = childOf(el, 'txBody');
            const kind = ph ? (/title/.test(ph.type) ? 'title' : 'body') : 'other';
            const lists = [];
            if (lph) { const lt = childOf(childOf(lph, 'txBody'), 'lstStyle'); if (lt) lists.push(lt); }
            if (txBody && childOf(txBody, 'lstStyle')) lists.push(childOf(txBody, 'lstStyle'));
            const hasText = txBody && Array.from(txBody.getElementsByTagName('a:t')).some(t => t.textContent.trim());
            if (hasText || txBody) {
              const ins = txBody ? bodyInsets(txBody) : { l: 7.2, t: 3.6, r: 7.2, b: 3.6, anchor: 't' };
              const paras = txBody ? textParas(txBody, kind, lists, mxml && mxml.documentElement) : [];
              if (ins.scale !== 1) paras.forEach(p => { p.lineH *= ins.scale; p.before *= ins.scale; p.runs.forEach(r => (r.sz *= ins.scale)); });
              items.push({ k: 'text', box, fill: fill === 'none' ? null : fill, line, geom, ins, paras });
            } else if (fill || line) items.push({ k: 'shape', box, fill: fill === 'none' ? null : fill, line, geom });
          } else if (ln === 'pic') {
            const xf = childOf(childOf(el, 'spPr'), 'xfrm');
            const box = applyT(T, boxOf(xf));
            const blip = el.getElementsByTagName('a:blip')[0];
            const rid = blip && (blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || blip.getAttribute('r:embed'));
            const img = box && rid ? await pictureSrc(rels, rid) : null;
            if (img) items.push({ k: 'img', box, src: img.src, ext: img.ext });
          } else if (ln === 'graphicFrame') {
            const xf = childOf(el, 'xfrm');
            const box = applyT(T, boxOf(xf));
            if (!box) continue;
            const gd = el.getElementsByTagName('a:graphicData')[0],
              uri = gd ? gd.getAttribute('uri') : '';
            if (/table$/.test(uri)) {
              const tbl = childOf(gd, 'tbl');
              const cols = childrenOf(childOf(tbl, 'tblGrid'), 'gridCol').map(g => (+g.getAttribute('w') || 0) / EMU);
              const cw = cols.reduce((a, b) => a + b, 0) || box.w,
                kx = box.w / cw;
              const tpr = childOf(tbl, 'tblPr'),
                firstRow = tpr && tpr.getAttribute('firstRow') === '1';
              const rows = childrenOf(tbl, 'tr').map((tr, ri) => ({
                h: (+tr.getAttribute('h') || 0) / EMU,
                cells: childrenOf(tr, 'tc').map((tc, ci) => {
                  const tcPr = childOf(tc, 'tcPr'),
                    sf = tcPr && childOf(tcPr, 'solidFill'),
                    head = firstRow && ri === 0,
                    band = !head && (ri % 2 === 1);
                  let fill = sf ? colorOf(sf) : null;
                  if (!fill) {
                    const acc = theme.accents[0];
                    fill = head ? acc : mixWhite(acc, band ? 0.4 : 0.2);
                  }
                  const txt = childOf(tc, 'txBody');
                  return { fill, paras: txt ? textParas(txt, 'other', [], mxml && mxml.documentElement).map(p => ({ ...p, runs: p.runs.map(r => ({ ...r, b: r.b || head, color: head ? 'FFFFFF' : r.color })) })) : [], ins: txt ? bodyInsets(txt) : { l: 3.6, r: 3.6, t: 3.6, b: 3.6, anchor: 'ctr' } };
                })
              }));
              items.push({ k: 'table', box, cols: cols.map(c => c * kx), rows: rows.map(r => ({ ...r, h: r.h * (box.h / Math.max(1, rows.reduce((a, b) => a + b.h, 0))) })) });
            } else if (/chart$/.test(uri)) {
              const cr = gd.getElementsByTagName('c:chart')[0],
                rid = cr && (cr.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || cr.getAttribute('r:id'));
              const rel = rid && rels[rid];
              const cxml = rel ? await readXml(rel.target) : null;
              if (cxml) items.push({ k: 'chart', box, chart: chartOf(cxml, theme) });
            }
          } else if (ln === 'grpSp') {
            const gxf = childOf(childOf(el, 'grpSpPr'), 'xfrm');
            const gb = applyT(T, boxOf(gxf));
            const chOff = childOf(gxf, 'chOff'),
              chExt = childOf(gxf, 'chExt');
            const cw = chExt ? +chExt.getAttribute('cx') / EMU : gb ? gb.w : 1,
              chh = chExt ? +chExt.getAttribute('cy') / EMU : gb ? gb.h : 1;
            const Tc = gb && chOff ? { ax: gb.x, ay: gb.y, cx: +chOff.getAttribute('x') / EMU, cy: +chOff.getAttribute('y') / EMU, sx: cw ? gb.w / cw : 1, sy: chh ? gb.h / chh : 1 } : T;
            await walk(Array.from(el.children).filter(c => /^(sp|pic|graphicFrame|grpSp)$/.test(c.localName)), Tc, lists, layoutTree, masterTree, rels);
          }
        }
      };
      // decorations of the master and the layout (shapes that are not placeholders), drawn under the slide
      const decor = tree => (tree ? Array.from(tree.children).filter(c => /^(sp|pic|graphicFrame|grpSp)$/.test(c.localName) && !phOf(c)) : []);
      const mTree = mxml ? childOf(childOf(mxml.documentElement, 'cSld'), 'spTree') : null,
        lTree = L.xml ? childOf(childOf(L.xml.documentElement, 'cSld'), 'spTree') : null;
      if (mTree && M) await walk(decor(mTree), IDT, [], null, null, M.rels);
      if (lTree) await walk(decor(lTree), IDT, [], null, null, lrels);
      if (spTree) await walk(Array.from(spTree.children).filter(c => /^(sp|pic|graphicFrame|grpSp)$/.test(c.localName)), IDT, [], L.xml && L.xml.documentElement, mxml && mxml.documentElement, srels);
      return { bg, bgImg, items };
    };
    // bar chart: title, categories and series
    const chartOf = (cx, th2) => {
      const title = Array.from(cx.getElementsByTagName('a:t')).map(t => t.textContent).join(' ') || '';
      const bar = cx.getElementsByTagName('c:barChart')[0];
      if (!bar) return null;
      const dir = (childOf(bar, 'barDir') || { getAttribute: () => 'col' }).getAttribute('val') || 'col';
      const cats = [];
      const series = childrenOf(bar, 'ser').map((ser, si) => {
        const name = (ser.getElementsByTagName('c:tx')[0] || {}).textContent || 'Series ' + (si + 1);
        const cat = ser.getElementsByTagName('c:cat')[0];
        if (cat && !cats.length) Array.from(cat.getElementsByTagName('c:pt')).forEach(pt => cats.push(pt.getElementsByTagName('c:v')[0].textContent));
        const vals = Array.from((ser.getElementsByTagName('c:val')[0] || { getElementsByTagName: () => [] }).getElementsByTagName('c:pt')).map(pt => +pt.getElementsByTagName('c:v')[0].textContent);
        const sp = childOf(ser, 'spPr'),
          fc = sp ? colorOf(childOf(sp, 'solidFill')) : null;
        return { name: name.trim(), vals, color: fc || th2.accents[si % th2.accents.length] };
      });
      return { title, dir, cats, series };
    };
    const slides = [];
    const pres2 = childrenOf(pres.documentElement, 'sldIdLst');
    const presRels = await relsOf('ppt/presentation.xml');
    const slideIds = pres2.length ? childrenOf(pres2[0], 'sldId') : [];
    const order = slideIds.map(s => presRels[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id')]).filter(Boolean).map(r => r.target);
    const paths = order.length ? order : Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    for (let i = 0; i < paths.length; i++) slides.push(await readSlide(paths[i], i));
    return { size, slides, theme };
  };
  // one slide as HTML (in points); ghost = text drawn transparent (used under editable Word text)
  const slideHtml = (sl, size, ghost) => {
    const T = v => (ghost ? 'transparent' : v);
    const spansOf = (runs, gh) => runs.map(r => '<span style="font-size:' + r.sz + 'pt;font-weight:' + (r.b ? 700 : 400) + ';font-style:' + (r.i ? 'italic' : 'normal') + ';color:' + (gh ? 'transparent' : '#' + r.color) + ';font-family:' + escHtml(fixFont(r.font || 'Calibri')) + '">' + escHtml(r.t) + '</span>').join('');
    const parasHtml = (paras, gh = ghost) => paras.map(p => {
      const lh = p.lineH || 14;
      const head = 'margin:' + (p.before || 0) + 'pt 0 0 0;padding-left:' + Math.max(0, p.marL + (p.bu ? 0 : 0)) + 'pt;text-indent:' + (p.bu ? p.indent : 0) + 'pt;text-align:' + ({ ctr: 'center', r: 'right', just: 'justify', l: 'left' }[p.algn] || 'left') + ';line-height:' + lh + 'pt;white-space:pre-wrap;';
      const bullet = p.bu ? '<span style="font-family:Arial;color:' + (gh ? 'transparent' : '#' + (p.runs[0] ? p.runs[0].color : '000000')) + '">' + escHtml(p.bu) + '\u00A0</span>' : '';
      if (!p.runs.length) return '<div style="' + head + '">&nbsp;</div>';
      return '<div style="' + head + '">' + bullet + spansOf(p.runs, gh) + '</div>';
    }).join('');
    const boxCss = b => 'position:absolute;left:' + b.x + 'pt;top:' + b.y + 'pt;width:' + b.w + 'pt;height:' + b.h + 'pt;box-sizing:border-box;';
    const out = [];
    out.push('<div style="position:relative;width:' + size.w + 'pt;height:' + size.h + 'pt;overflow:hidden;background:' + (sl.bg && /^[0-9A-F]{6}$/i.test(sl.bg.replace('#', '')) ? sl.bg : '#FFFFFF') + ';">');
    if (sl.bgImg) out.push('<img src="' + sl.bgImg.src + '" style="position:absolute;left:0;top:0;width:' + size.w + 'pt;height:' + size.h + 'pt;object-fit:fill;">');
    sl.items.forEach(it => {
      const b = it.box;
      if (!b) return;
      if (it.k === 'shape' || it.k === 'text') {
        const radius = it.geom === 'ellipse' ? '50%' : it.geom === 'roundRect' ? Math.min(b.w, b.h) * 0.1667 + 'pt' : '0';
        const border = it.line && it.line.w ? it.line.w + 'pt solid #' + it.line.c : 'none';
        let css = boxCss(b) + 'background:' + (it.fill ? '#' + it.fill : 'transparent') + ';border:' + border + ';border-radius:' + radius + ';';
        if (it.k === 'text') {
          css += 'padding:' + it.ins.t + 'pt ' + it.ins.r + 'pt ' + it.ins.b + 'pt ' + it.ins.l + 'pt;display:flex;flex-direction:column;justify-content:' + ({ ctr: 'center', b: 'flex-end' }[it.ins.anchor] || 'flex-start') + ';overflow:visible;';
          out.push('<div style="' + css + '">' + parasHtml(it.paras) + '</div>');
        } else out.push('<div style="' + css + '"></div>');
      } else if (it.k === 'img') {
        out.push('<img src="' + it.src + '" style="' + boxCss(b) + 'object-fit:fill;">');
      } else if (it.k === 'table') {
        const rowsH = it.rows.map(r => '<tr style="height:' + r.h + 'pt">' + r.cells.map((c, ci) => '<td style="width:' + it.cols[ci] + 'pt;background:#' + c.fill + ';border:1pt solid #FFFFFF;padding:' + c.ins.t + 'pt ' + c.ins.r + 'pt ' + c.ins.b + 'pt ' + c.ins.l + 'pt;vertical-align:' + (c.ins.anchor === 'ctr' ? 'middle' : 'top') + ';overflow:hidden;">' + (c.paras.length ? parasHtml(c.paras, false) : '') + '</td>').join('') + '</tr>').join('');
        out.push('<table style="' + boxCss(b) + 'border-collapse:collapse;table-layout:fixed;"><colgroup>' + it.cols.map(w => '<col style="width:' + w + 'pt">').join('') + '</colgroup><tbody>' + rowsH + '</tbody></table>');
      } else if (it.k === 'chart' && it.chart) {
        const T = v => v; // the chart is always drawn in full colour
        const c = it.chart,
          top = c.title ? 28 : 12,
          left = 46,
          bottom = 34,
          pw = b.w - left - 14,
          ph = b.h - top - bottom;
        let mx = 0;
        c.series.forEach(s => s.vals.forEach(v => (mx = Math.max(mx, v))));
        const step = Math.pow(10, Math.floor(Math.log10(mx || 1))),
          max = Math.ceil(mx / step) * step || 1;
        let g = '';
        if (c.title) g += '<div style="position:absolute;left:0;top:4pt;width:' + b.w + 'pt;text-align:center;font:600 14pt Calibri;color:' + T('#2B2118') + '">' + escHtml(c.title) + '</div>';
        for (let t = 0; t <= 4; t++) {
          const yy = top + ph - (ph * t) / 4, v = (max * t) / 4;
          g += '<div style="position:absolute;left:' + left + 'pt;top:' + yy + 'pt;width:' + pw + 'pt;border-top:0.5pt solid ' + T('#D9D9D9') + '"></div><div style="position:absolute;left:0;top:' + (yy - 7) + 'pt;width:' + (left - 6) + 'pt;text-align:right;font:9pt Calibri;color:' + T('#595959') + '">' + +v.toFixed(1) + '</div>';
        }
        const nc = Math.max(1, c.cats.length), gw = pw / nc, ns = Math.max(1, c.series.length), bw = (gw * 0.7) / ns;
        c.cats.forEach((cat, ci) => {
          g += '<div style="position:absolute;left:' + (left + ci * gw) + 'pt;top:' + (top + ph + 6) + 'pt;width:' + gw + 'pt;text-align:center;font:9pt Calibri;color:' + T('#595959') + '">' + escHtml(cat) + '</div>';
          c.series.forEach((s, si) => {
            const v = s.vals[ci] || 0, hh = (ph * v) / max;
            g += '<div style="position:absolute;left:' + (left + ci * gw + gw * 0.15 + si * bw) + 'pt;top:' + (top + ph - hh) + 'pt;width:' + bw + 'pt;height:' + hh + 'pt;background:' + T('#' + s.color) + '"></div>';
          });
        });
        out.push('<div style="' + boxCss(b) + '">' + g + '</div>');
      }
    });
    out.push('</div>');
    return out.join('');
  };
  const makeFrame = () => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:absolute;left:-30000px;top:0;width:1600px;height:1200px;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const idoc = frame.contentDocument;
    idoc.open();
    idoc.write('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}</style></head><body></body></html>');
    idoc.close();
    return { frame, idoc };
  };
  const textBoxXml = (it, id, z) => {
    const b = it.box,
      cx = Math.round(b.w * PT),
      // a text box must be tall enough for its text, or Word cuts the last lines off
      need = it.paras.reduce((sum, p) => {
        const sz = p.runs.reduce((m, r) => Math.max(m, r.sz), 12),
          chars = p.runs.reduce((n, r) => n + r.t.length, 0),
          lines = Math.max(1, Math.ceil((chars * sz * 0.55) / Math.max(20, b.w - p.marL)));
        return sum + (p.before || 0) + p.lineH * lines;
      }, 0) + it.ins.t + it.ins.b,
      cy = Math.round(Math.max(b.h, need) * PT),
      ALIGN = { ctr: 'center', r: 'right', just: 'both', l: 'left' };
    const content = it.paras.map(p => {
      const runs = p.runs.map(r => ({ t: r.t, font: r.font, hp: Math.round(r.sz * 2), b: r.b, i: r.i, col: r.color && r.color !== '000000' ? r.color : '' }));
      if (p.bu && runs.length) runs.unshift({ t: p.bu + '\t', font: 'Arial', hp: runs[0].hp, b: false, i: false, col: runs[0].col });
      else if (p.bu) runs.push({ t: p.bu, font: 'Arial', hp: 24, b: false, i: false, col: '' });
      return {
        runs,
        align: ALIGN[p.algn] || 'left',
        left: p.marL,
        hang: p.indent < 0 ? -p.indent : 0,
        first: p.indent > 0 ? p.indent : 0,
        before: p.before,
        pitch: p.lineH,
        tabs: p.bu ? [p.marL] : null
      };
    });
    const body = content.map(p => paraXml(p)).join('') || '<w:p/>';
    const fill = it.fill ? '<a:solidFill><a:srgbClr val="' + it.fill + '"/></a:solidFill>' : '<a:noFill/>';
    const line = it.line && it.line.w ? '<a:ln w="' + Math.round(it.line.w * PT) + '"><a:solidFill><a:srgbClr val="' + (it.line.c || '000000') + '"/></a:solidFill></a:ln>' : '<a:ln><a:noFill/></a:ln>';
    const geom = it.geom === 'ellipse' ? 'ellipse' : it.geom === 'roundRect' ? 'roundRect' : 'rect';
    const anc = it.ins.anchor === 'ctr' ? 'ctr' : it.ins.anchor === 'b' ? 'b' : 't';
    return (
      '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="' + (251658240 + z) + '" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>' + Math.round(b.x * PT) + '</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>' + Math.round(b.y * PT) + '</wp:posOffset></wp:positionV><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="' + id + '" name="Text ' + id + '"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="' + geom + '"><a:avLst/></a:prstGeom>' + fill + line + '</wps:spPr><wps:txbx><w:txbxContent>' + body + '</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="' + Math.round(it.ins.l * PT) + '" tIns="' + Math.round(it.ins.t * PT) + '" rIns="' + Math.round(it.ins.r * PT) + '" bIns="' + Math.round(it.ins.b * PT) + '" anchor="' + anc + '" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r>'
    );
  };
  // PowerPoint -> Word: each slide is one page; the slide picture sits behind editable text boxes
  const pptxToDocx = async f => {
    await Lib.jszip();
    await Promise.all([Lib.html2canvas()]);
    const model = await pptOpen(f);
    const { frame, idoc } = makeFrame();
    Lib.officeFonts(idoc);
    try {
      const W = model.size.w,
        H = model.size.h,
        max = Math.min(model.slides.length, 60),
        media = [];
      let body = '',
        id = 0;
      for (let i = 0; i < max; i++) {
        msg('Building slide ' + (i + 1) + ' of ' + max + '…');
        const host = idoc.createElement('div');
        host.innerHTML = slideHtml(model.slides[i], model.size, true);
        idoc.body.innerHTML = '';
        idoc.body.appendChild(host);
        await imagesReady(host);
        const sec = host.firstElementChild,
          c = await html2canvas(sec, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }),
          blob = await canvasBlob(c, 'image/jpeg', 0.9),
          pid = ++id;
        media.push({ id: pid, ext: 'jpeg', data: new Uint8Array(await blob.arrayBuffer()) });
        let z = 0,
          inner = anchorXml({ x: 0, y: 0, w: W, h: H, ext: 'jpeg' }, pid, 'none', ++z, true);
        model.slides[i].items.filter(it => it.k === 'text' && it.paras.length).forEach(it => {
          inner += textBoxXml(it, 1000 + ++id, ++z);
        });
        body += '<w:p><w:pPr>' + (i ? '<w:pageBreakBefore/>' : '') + '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>' + inner + '</w:p>';
        bar(10 + Math.round(((i + 1) / max) * 85));
        await tick();
      }
      if (model.slides.length > max) doc_note = 'Only the first ' + max + ' slides were converted.';
      return buildDocx({ body, media, pg: { w: W, h: H, t: 0, r: 0, b: 0, l: 0, hd: 0, ft: 0 } });
    } finally {
      frame.remove();
    }
  };
  const pptxToPdfExact = async f => {
    await Lib.jszip();
    await Promise.all([Lib.html2canvas(), Lib.jspdf()]);
    const model = await pptOpen(f);
    const { frame, idoc } = makeFrame();
    Lib.officeFonts(idoc);
    try {
      const max = Math.min(model.slides.length, 80),
        k = 0.75;
      let pdf = null;
      for (let i = 0; i < max; i++) {
        msg('Drawing slide ' + (i + 1) + ' of ' + max + '…');
        const host = idoc.createElement('div');
        host.innerHTML = slideHtml(model.slides[i], model.size, false);
        idoc.body.innerHTML = '';
        idoc.body.appendChild(host);
        if (idoc.fonts && idoc.fonts.ready) await Promise.race([idoc.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
        await imagesReady(host);
        const sec = host.firstElementChild,
          w = model.size.w,
          h = model.size.h,
          c = await html2canvas(sec, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
        const fmt = [w, h],
          ori = w > h ? 'l' : 'p';
        if (!pdf) pdf = new jspdf.jsPDF({ unit: 'pt', format: fmt, orientation: ori, compress: true });
        else pdf.addPage(fmt, ori);
        pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h, undefined, 'FAST');
        addHiddenText(pdf, sec, k, 0, sec.offsetHeight, 0);
        bar(10 + Math.round(((i + 1) / max) * 85));
        await tick();
      }
      if (model.slides.length > max) doc_note = 'Only the first ' + max + ' slides were converted.';
      return pdf.output('blob');
    } finally {
      frame.remove();
    }
  };
  // ---------- PDF -> Word that keeps layout, pictures, tables and text styles ----------
  const NS =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
  const median = a => {
    const s = a.slice().sort((x, y) => x - y);
    return s.length ? s[s.length >> 1] : 0;
  };
  const rPr = r =>
    '<w:rPr><w:rFonts w:ascii="' + xml(r.font) + '" w:hAnsi="' + xml(r.font) + '" w:cs="' + xml(r.font) + '" w:eastAsia="' + xml(r.font) + '"/>' +
    (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.col ? '<w:color w:val="' + r.col + '"/>' : '') +
    '<w:sz w:val="' + r.hp + '"/><w:szCs w:val="' + r.hp + '"/></w:rPr>';
  const runXml = r => {
    if (r.field)
      return '<w:r>' + rPr(r) + '<w:fldChar w:fldCharType="begin"/></w:r><w:r>' + rPr(r) + '<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>' + rPr(r) + '<w:fldChar w:fldCharType="separate"/></w:r><w:r>' + rPr(r) + '<w:t>' + xml(r.t) + '</w:t></w:r><w:r>' + rPr(r) + '<w:fldChar w:fldCharType="end"/></w:r>';
    const parts = String(r.t).split('\t');
    return parts.map((x, j) => '<w:r>' + rPr(r) + (j ? '<w:tab/>' : '') + (x ? '<w:t xml:space="preserve">' + xml(x) + '</w:t>' : '') + '</w:r>').join('');
  };
  const mergeRuns = runs => {
    const out = [];
    runs.forEach(r => {
      const p = out[out.length - 1];
      if (!p || p.field || r.field || p.font !== r.font || p.hp !== r.hp || p.b !== r.b || p.i !== r.i || (p.col || '') !== (r.col || '')) out.push({ ...r });
      else p.t += r.t;
    });
    return out;
  };
  const picXml = (im, id) => {
    const cx = Math.round(im.w * PT),
      cy = Math.round(im.h * PT);
    return (
      '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Picture ' + id + '"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="image' + id + '.' + im.ext + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId' + (id + 10) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    );
  };
  // a picture fixed to an exact spot on the page, so it can never be pushed onto another page
  const anchorXml = (im, id, wrap, z, behind, vRel) => {
    const cx = Math.round(im.w * PT),
      cy = Math.round(im.h * PT);
    return (
      '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="' + (251658240 + z) + '" behindDoc="' + (behind ? 1 : 0) + '" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>' + Math.round(im.x * PT) + '</wp:posOffset></wp:positionH><wp:positionV relativeFrom="' + (vRel || 'page') + '"><wp:posOffset>' + Math.round(im.y * PT) + '</wp:posOffset></wp:positionV><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' + (wrap === 'none' ? '<wp:wrapNone/>' : '<wp:wrapTopAndBottom/>') + '<wp:docPr id="' + id + '" name="Picture ' + id + '"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="image' + id + '.' + im.ext + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId' + (id + 10) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>'
    );
  };
  const paraXml = p => {
    let pr = '';
    if (p.style) pr += '<w:pStyle w:val="' + p.style + '"/>';
    if (p.pageBreak) pr += '<w:pageBreakBefore/>';
    if (p.tabs && p.tabs.length) pr += '<w:tabs>' + p.tabs.map(x => '<w:tab w:val="left" w:pos="' + tw(Math.max(0, x)) + '"/>').join('') + '</w:tabs>';
    pr += '<w:spacing w:before="' + tw(Math.max(0, p.before || 0)) + '" w:after="0"' + (p.pitch ? ' w:line="' + tw(p.pitch) + '" w:lineRule="exact"' : '') + '/>';
    pr += '<w:ind w:left="' + tw(p.left || 0) + '"' + (p.hang ? ' w:hanging="' + tw(p.hang) + '"' : p.first ? ' w:firstLine="' + tw(p.first) + '"' : '') + '/>';
    if (p.align && p.align !== 'left') pr += '<w:jc w:val="' + p.align + '"/>';
    return '<w:p><w:pPr>' + pr + '</w:pPr>' + (p.img ? p.img : mergeRuns(p.runs || []).map(runXml).join('')) + '</w:p>';
  };
  const tableXml = tb => {
    const grid = tb.cols.map(c => '<w:gridCol w:w="' + tw(c) + '"/>').join('');
    const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>').join('');
    const rows = tb.rows.map((r, ri) =>
        '<w:tr><w:trPr><w:trHeight w:val="' + tw(Math.max(10, tb.hs[ri] || 14)) + '" w:hRule="atLeast"/></w:trPr>' + r.map((cell, i) => '<w:tc><w:tcPr><w:tcW w:w="' + tw(tb.cols[i]) + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
          (cell.length ? cell.map(p => paraXml({ runs: p, pitch: 0 })).join('') : '<w:p/>') + '</w:tc>').join('') + '</w:tr>'
      ).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="' + tw(tb.cols.reduce((a, b) => a + b, 0)) + '" w:type="dxa"/><w:tblInd w:w="' + tw(tb.indent) + '" w:type="dxa"/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' + rows + '</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
  };
  const buildDocx = async ({ body, media, pg, hdr, ftr }) => {
    await Lib.jszip();
    const z = new JSZip(),
      H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    z.file('[Content_Types].xml', H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' + (hdr ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') + (ftr ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>');
    z.file('_rels/.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    let rels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    media.forEach(m => {
      rels += '<Relationship Id="rId' + (m.id + 10) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image' + m.id + '.' + m.ext + '"/>';
      z.file('word/media/image' + m.id + '.' + m.ext, m.data);
    });
    if (hdr) {
      rels += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>';
      z.file('word/header1.xml', H + '<w:hdr ' + NS + '>' + hdr + '</w:hdr>');
    }
    if (ftr) {
      rels += '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>';
      z.file('word/footer1.xml', H + '<w:ftr ' + NS + '>' + ftr + '</w:ftr>');
    }
    z.file('word/_rels/document.xml.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>');
    const hd = n => '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext w:val=\"0\"/><w:keepLines w:val=\"0\"/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr></w:style>';
    z.file('word/styles.xml', H + '<w:styles ' + NS + '><w:docDefaults><w:pPrDefault><w:pPr><w:widowControl w:val=\"0\"/></w:pPr></w:pPrDefault><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' + hd(1) + hd(2) + hd(3) + '</w:styles>');
    z.file('word/document.xml', H + '<w:document ' + NS + '><w:body>' + (body || '<w:p/>') + '<w:sectPr>' + (hdr ? '<w:headerReference w:type="default" r:id="rId2"/>' : '') + (ftr ? '<w:footerReference w:type="default" r:id="rId3"/>' : '') + '<w:pgSz w:w="' + tw(pg.w) + '" w:h="' + tw(pg.h) + '"/><w:pgMar w:top="' + tw(pg.t) + '" w:right="' + tw(pg.r) + '" w:bottom="' + tw(pg.b) + '" w:left="' + tw(pg.l) + '" w:header="' + tw(pg.hd || 0) + '" w:footer="' + tw(pg.ft || 0) + '" w:gutter="0"/></w:sectPr></w:body></w:document>');
    return z.generateAsync({ type: 'blob', mimeType: NAME.docx, compression: 'DEFLATE' });
  };

  const mul = (A, B) => [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]
  ];
  const bitmapToPng = async src => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };
  const imageObjToCanvas = async o => {
    if (o.bitmap) return bitmapToPng(o.bitmap);
    if (!o.data || !o.width) return null;
    const c = document.createElement('canvas');
    c.width = o.width;
    c.height = o.height;
    const g = c.getContext('2d'),
      id = g.createImageData(o.width, o.height),
      d = id.data,
      s = o.data,
      n = o.width * o.height;
    if (o.kind === 3 || s.length === n * 4) d.set(s.subarray ? s.subarray(0, n * 4) : s);
    else if (o.kind === 2 || s.length === n * 3) for (let i = 0, j = 0; i < n; i++, j += 3) { d[i * 4] = s[j]; d[i * 4 + 1] = s[j + 1]; d[i * 4 + 2] = s[j + 2]; d[i * 4 + 3] = 255; }
    else { const rowB = (o.width + 7) >> 3; for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) { const v = (s[y * rowB + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0, i = (y * o.width + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } }
    g.putImageData(id, 0, 0);
    return c;
  };

  // Read one PDF page: text lines (with fonts and positions) and pictures
  const readPdfPage = async page => {
    const vp = page.getViewport({ scale: 1 }),
      ops = await page.getOperatorList(),
      tc = await page.getTextContent({ disableCombineTextItems: true }),
      pt = (x, y) => vp.convertToViewportPoint(x, y);
    // draw the page once so the real text colours can be read from it
    let cg = null;
    try {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width);
      cv.height = Math.ceil(vp.height);
      cg = cv.getContext('2d', { willReadFrequently: true });
      cg.fillStyle = '#fff';
      cg.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cg, viewport: vp }).promise;
    } catch (e) {
      cg = null;
    }
    const colorAt = (x, y, w, h) => {
      if (!cg || w < 2) return '';
      const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), ww = Math.min(cg.canvas.width - x0, Math.ceil(w)), hh = Math.min(cg.canvas.height - y0, Math.ceil(h));
      if (ww < 1 || hh < 1) return '';
      const d = cg.getImageData(x0, y0, ww, hh).data;
      let best = 999, r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] + d[i + 1] + d[i + 2];
        if (l < best) { best = l; r = d[i]; g = d[i + 1]; b = d[i + 2]; }
      }
      if (best > 700 || (r < 70 && g < 70 && b < 70)) return '';
      return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    };
    const fontInfo = {};
    const finfo = name => {
      if (fontInfo[name]) return fontInfo[name];
      let o = null;
      try { o = page.commonObjs.has(name) ? page.commonObjs.get(name) : null; } catch (e) {}
      const real = (o && (o.name || o.loadedName)) || '',
        fam = (tc.styles[name] && tc.styles[name].fontFamily) || '';
      return (fontInfo[name] = {
        font: wordFont(real, fam),
        b: !!(o && o.bold) || /bold|black|heavy|semibold|demi/i.test(real),
        i: !!(o && o.italic) || /italic|oblique/i.test(real)
      });
    };
    const items = [];
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim() || !it.transform) return; // blank pieces only stand for the gaps
      const [a, b, , d] = it.transform;
      if (Math.abs(b) > Math.abs(a) * 0.3) return; // skip rotated text
      const [x, y] = pt(it.transform[4], it.transform[5]),
        fs = Math.hypot(a, b) || Math.abs(d) || 10,
        fi = finfo(it.fontName);
      items.push({ s: it.str, x, y, w: it.width || 0, fs, col: colorAt(x, y - fs * 0.8, it.width || 0, fs * 0.95), ...fi });
    });
    // group pieces into lines (same baseline), left to right
    items.sort((p, q) => p.y - q.y || p.x - q.x);
    const rows = [];
    items.forEach(it => {
      const r = rows.find(r => Math.abs(r.y - it.y) < Math.max(1.5, it.fs * 0.35));
      if (r) r.its.push(it);
      else rows.push({ y: it.y, its: [it] });
    });
    rows.sort((p, q) => p.y - q.y);
    const lines = [];
    rows.forEach(r => {
      r.its.sort((p, q) => p.x - q.x);
      const segs = [];
      let seg = null,
        end = null,
        fs = 0,
        chars = 0;
      r.its.forEach(it => {
        const gap = end === null ? 0 : it.x - end;
        if (!seg || gap > Math.max(it.fs, 8) * 2.2) {
          seg = { x0: it.x, x1: it.x + it.w, runs: [] };
          segs.push(seg);
        } else {
          const lastRun = seg.runs[seg.runs.length - 1];
          if (gap > it.fs * 0.14 && !/\s$/.test(lastRun.t) && !/^\s/.test(it.s)) lastRun.t += ' ';
        }
        seg.runs.push({ t: it.s, font: it.font, hp: Math.max(2, Math.min(400, Math.round(it.fs * 2))), b: it.b, i: it.i, col: it.col });
        seg.x1 = it.x + it.w;
        end = seg.x1;
        fs = Math.max(fs, it.fs);
        chars += it.s.length;
      });
      const text = segs.map(s => s.runs.map(x => x.t).join('')).join(' ').trim();
      if (!text) return;
      segs.forEach(s => (s.runs = mergeRuns(s.runs)));
      lines.push({ y: r.y, fs, segs, x0: segs[0].x0, x1: segs[segs.length - 1].x1, text, chars, bold: segs.every(s => s.runs.every(x => x.b)), top: r.y - fs });
    });
    // pictures
    const OPS = pdfjsLib.OPS,
      images = [],
      vlines = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    for (let i = 0; i < ops.fnArray.length && images.length < 60; i++) {
      const fn = ops.fnArray[i],
        args = ops.argsArray[i];
      if (fn === OPS.constructPath) {
        // straight vertical lines (table borders): remember where they are
        const pops = args[0],
          co = args[1];
        let ci = 0,
          cur = null;
        const addV = (x1, y1, x2, y2) => {
          if (Math.abs(x1 - x2) < 1.2 && Math.abs(y1 - y2) > 8) {
            const a = pt(...[ctm[0] * x1 + ctm[2] * y1 + ctm[4], ctm[1] * x1 + ctm[3] * y1 + ctm[5]]),
              b = pt(...[ctm[0] * x2 + ctm[2] * y2 + ctm[4], ctm[1] * x2 + ctm[3] * y2 + ctm[5]]);
            vlines.push({ x: (a[0] + b[0]) / 2, y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
          }
        };
        for (const op of pops) {
          if (op === OPS.moveTo) { cur = [co[ci], co[ci + 1]]; ci += 2; }
          else if (op === OPS.lineTo) { if (cur) addV(cur[0], cur[1], co[ci], co[ci + 1]); cur = [co[ci], co[ci + 1]]; ci += 2; }
          else if (op === OPS.rectangle) {
            const x = co[ci], y = co[ci + 1], w = co[ci + 2], h = co[ci + 3];
            if (Math.abs(w) < 1.5) addV(x + w / 2, y, x + w / 2, y + h);
            else if (Math.abs(h) > 8) { addV(x, y, x, y + h); addV(x + w, y, x + w, y + h); }
            ci += 4;
          } else if (op === OPS.curveTo) ci += 6;
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
        }
      } else if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const P = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => pt(ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]));
        const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
        const bb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        if (bb.w < 10 || bb.h < 10) continue;
        let obj = null;
        try {
          if (fn === OPS.paintInlineImageXObject) obj = args[0];
          else obj = await new Promise(res => { let done = false; const t = setTimeout(() => !done && res(null), 3000); page.objs.get(args[0], o => { done = true; clearTimeout(t); res(o); }); });
        } catch (e) {}
        // read the picture now: the browser releases picture data once the page is done
        let cv = obj ? await imageObjToCanvas(obj).catch(() => null) : null;
        // a picture used on several pages can come back empty: take it from the page picture instead
        if (!cv && cg && bb.w >= 2 && bb.h >= 2) {
          cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(bb.w));
          cv.height = Math.max(1, Math.round(bb.h));
          cv.getContext('2d').drawImage(cg.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, cv.width, cv.height);
        }
        if (cv) images.push({ ...bb, cv });
      }
    }
    return { PW: vp.width, PH: vp.height, lines, images, vlines, chars: lines.reduce((a, l) => a + l.chars, 0) };
  };

  // Turn the lines of one PDF page into paragraphs, tables and pictures
  const BUL = /^([•◦▪▫●○■□◆◇·‣⁃\u2022\uF0B7\uF0A7\uF0D8\-–—*])\s*/;
  const NUM = /^(\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|[ivxlcIVXLC]{1,5}[.)])\s+/;
  const flatRuns = l => {
    const out = [];
    l.segs.forEach((s, i) => {
      if (i) out.push({ ...s.runs[0], t: '\t' });
      s.runs.forEach(r => out.push({ ...r }));
    });
    return out;
  };
  const layoutPdfPage = (pg, st) => {
    const { L, R } = st,
      W = R - L,
      lines = pg.lines.slice().sort((a, b) => a.y - b.y),
      blocks = [],
      free = [],
      used = new Set();
    // ---- tables: neighbouring lines whose pieces line up in columns ----
    const isRow = lines.map(l => l.segs.length >= 2);
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      if (isRow[i]) {
        let j = i;
        while (j + 1 < lines.length && isRow[j + 1] && lines[j + 1].y - lines[j].y < Math.max(lines[j + 1].fs * 3.2, 24)) j++;
        if (j > i) {
          const xs = [];
          lines.slice(i, j + 1).forEach(l => l.segs.forEach(s => xs.push(s.x0)));
          xs.sort((a, b) => a - b);
          const cl = [];
          xs.forEach(x => {
            const c = cl[cl.length - 1];
            if (c && x - c.x < 9) { c.n++; c.x = (c.x * (c.n - 1) + x) / c.n; } else cl.push({ x, n: 1 });
          });
          const cols = cl.filter(c => c.n >= 2).map(c => c.x);
          if (cols.length >= 2) {
            let k = j;
            while (k + 1 < lines.length && lines[k + 1].segs.length === 1 && cols.some(c => Math.abs(lines[k + 1].x0 - c) < 9) && lines[k + 1].y - lines[k].y < lines[k + 1].fs * 1.9) k++;
            const rows = [],
              ys = [];
            let maxX1 = 0;
            for (let m = i; m <= k; m++) {
              const l = lines[m];
              used.add(m);
              const cont = m > j && rows.length,
                row = cont ? rows[rows.length - 1] : cols.map(() => []);
              l.segs.forEach(s => {
                let ci = 0;
                cols.forEach((c, idx) => { if (s.x0 >= c - 9) ci = idx; });
                if (ci === cols.length - 1) maxX1 = Math.max(maxX1, s.x1);
                const runs = s.runs.map(r => ({ ...r }));
                const cell = row[ci];
                if (cont || !cell.length) cell.push(runs);
                else cell[cell.length - 1].push({ ...runs[0], t: ' ' }, ...runs);
              });
              if (!cont) {
                rows.push(row);
                ys.push(l.y);
              }
            }
            let widths = cols.map((c, idx) => (idx < cols.length - 1 ? cols[idx + 1] - c : Math.max(40, maxX1 + 12 - c))),
              tx0 = cols[0] - 4;
            // the real cell edges, when the PDF drew them
            const y0 = lines[i].top - 4,
              y1 = lines[k].y + lines[k].fs * 0.5,
              xs2 = [];
            (pg.vlines || []).forEach(v => {
              if (v.y0 <= y0 + (y1 - y0) * 0.6 && v.y1 >= y1 - (y1 - y0) * 0.6 && !xs2.some(x => Math.abs(x - v.x) < 2)) xs2.push(v.x);
            });
            xs2.sort((a, b) => a - b);
            if (xs2.length >= cols.length + 1) {
              const edges = [];
              let ok = true;
              cols.forEach((c, idx) => {
                const lo = xs2.filter(x => x <= c + 2).pop(),
                  hi = xs2.find(x => x > (idx < cols.length - 1 ? cols[idx] + 4 : maxX1));
                if (lo === undefined || hi === undefined) ok = false;
                else edges.push([lo, hi]);
              });
              if (ok && edges.every((e, idx) => !idx || e[0] >= edges[idx - 1][1] - 3)) {
                widths = edges.map((e, idx) => (idx < edges.length - 1 ? edges[idx + 1][0] : e[1]) - e[0]);
                tx0 = edges[0][0];
              }
            }
            blocks.push({ kind: 'tbl', top: lines[i].top, bottom: lines[k].y + lines[k].fs * 0.35, tb: { cols: widths, indent: Math.max(0, tx0 - L), rows, hs: ys.map((y, i) => (i < ys.length - 1 ? ys[i + 1] - y : median(ys.slice(1).map((v, j) => v - ys[j])) || lines[i].fs * 1.4)) } });
            continue;
          }
        }
      }
      free.push(lines[i]);
    }
    // ---- paragraphs ----
    const hdLevel = fs => {
      if (fs < st.body * 1.18) return 0;
      const idx = st.heads.findIndex(h => Math.abs(h - fs) < 0.9);
      return Math.min(3, (idx < 0 ? st.heads.length : idx) + 1);
    };
    const alignOf = l => {
      const cx = (l.x0 + l.x1) / 2,
        mid = (L + R) / 2,
        w = l.x1 - l.x0;
      if (Math.abs(cx - mid) < W * 0.035 && w < W * 0.88 && l.x0 > L + W * 0.06) return 'center';
      if (Math.abs(l.x1 - R) < 3 && l.x0 > L + W * 0.45) return 'right';
      return 'left';
    };
    const paras = [];
    let cur = null;
    free.forEach(l => {
      const hd = hdLevel(l.fs),
        isList = !hd && !l.bold && (BUL.test(l.text) || NUM.test(l.text)),
        al = alignOf(l);
      let merge = false;
      if (cur && !isList) {
        const P = cur.lines[cur.lines.length - 1],
          pitch = l.y - P.y;
        merge =
          cur.align === 'left' && al === 'left' && cur.hd === hd &&
          pitch > 0 && pitch <= Math.max(P.fs * 1.75, 3) &&
          Math.abs(l.fs - P.fs) < 0.9 &&
          P.x1 >= R - W * 0.22 &&
          (cur.lines.length === 1 ? l.x0 <= P.x0 + 3 && l.x0 >= P.x0 - 40 || (cur.list && l.x0 > P.x0 + 4 && l.x0 < P.x0 + 44) : Math.abs(l.x0 - cur.bodyX) < 4);
      }
      if (merge) {
        cur.lines.push(l);
        if (cur.lines.length === 2) cur.bodyX = l.x0;
      } else {
        cur = { lines: [l], align: al, hd, list: isList, bodyX: l.x0 };
        paras.push(cur);
      }
    });
    paras.forEach(p => {
      const first = p.lines[0],
        rest = p.lines.slice(1);
      const runs = [];
      p.lines.forEach((l, i) => {
        const fr = flatRuns(l);
        if (i) {
          const last = runs[runs.length - 1];
          if (last && /[A-Za-z]-$/.test(last.t) && /^[a-z]/.test(fr[0] ? fr[0].t : '')) last.t = last.t.slice(0, -1);
          else if (last) last.t += ' ';
        }
        fr.forEach(r => runs.push(r));
      });
      if (p.list) {
        const m = (first.text.match(BUL) || [])[1];
        if (m && runs[0]) runs[0].t = runs[0].t.replace(BUL, '•\t');
      }
      p.runs = runs;
      const colLine = p.lines.find(x => x.segs.length > 1);
      if (colLine) p.tabs = colLine.segs.slice(1).map(s => s.x0 - L);
      const pit = [];
      for (let i = 1; i < p.lines.length; i++) pit.push(p.lines[i].y - p.lines[i - 1].y);
      p.pitch = pit.length ? Math.max(6, median(pit)) : Math.max(8, first.fs * 1.2);
      p.left = Math.max(0, (rest.length ? p.bodyX : first.x0) - L);
      if (p.align === 'center' || p.align === 'right') p.left = 0;
      if (rest.length) {
        const d = first.x0 - p.bodyX;
        if (p.list || d < -2) p.hang = Math.max(0, Math.min(40, p.bodyX - first.x0));
        else if (d > 2) p.first = d;
        if (p.hang) p.left = Math.max(0, p.bodyX - L);
      } else if (p.list) {
        p.hang = 18;
        p.left = first.x0 - L + 18;
      }
      if (p.align === 'left' && rest.length >= 2 && rest.slice(0, -1).every(l => Math.abs(l.x1 - first.x1) < 5 || l.x1 > R - 4) && first.x1 > R - W * 0.06) p.align = 'both';
      if (p.hd) p.style = 'Heading' + p.hd;
      blocks.push({ kind: 'p', top: first.top, bottom: p.lines[p.lines.length - 1].y, p });
    });
    // ---- pictures: fixed on the page where they were; text may run beside them or above and below ----
    const floats = [];
    pg.images.forEach(im => {
      if (im.w * im.h > pg.PW * pg.PH * 0.85 && pg.chars > 30) return;
      const beside = lines.some(l => l.y >= im.y && l.top <= im.y + im.h);
      floats.push({ im, wrap: beside ? 'none' : 'tb' });
    });
    blocks.sort((a, b) => a.top - b.top);
    return { blocks, floats };
  };

  const percentile = (a, q) => {
    const s = a.slice().sort((x, y) => x - y);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
  };
  const canvasPicture = async c => {
    const k = Math.min(1, 1600 / Math.max(c.width, c.height)),
      o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(c.width * k));
    o.height = Math.max(1, Math.round(c.height * k));
    const g = o.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, o.width, o.height);
    g.drawImage(c, 0, 0, o.width, o.height);
    const big = o.width * o.height > 250000,
      b = await canvasBlob(o, big ? 'image/jpeg' : 'image/png', 0.88);
    return { ext: big ? 'jpeg' : 'png', data: new Uint8Array(await b.arrayBuffer()) };
  };

  // PDF -> editable Word that keeps the layout
  const pdfToDocx = async f => {
    const pdf = await Lib.openPdf(f),
      n = Math.min(pdf.numPages, 80),
      pages = [];
    for (let i = 1; i <= n; i++) {
      msg('Reading page ' + i + ' of ' + n + '…');
      pages.push(await readPdfPage(await pdf.getPage(i)));
      bar(Math.round((i / n) * 50));
      if (i % 3 === 0) await tick();
    }
    const PW = pages[0].PW,
      PH = pages[0].PH,
      textPages = pages.filter(p => p.chars >= 15);
    // lines that repeat at the top or bottom of the pages become the Word header and footer
    const hfKey = l => l.text.replace(/\d+/g, '#').toLowerCase(),
      isTop = (l, pg) => l.y < pg.PH * 0.1,
      isBot = (l, pg) => l.y > pg.PH * 0.9,
      counts = {},
      heads0 = [],
      foots0 = [];
    textPages.forEach(pg => {
      const seen = new Set();
      pg.lines.forEach(l => {
        const top = isTop(l, pg);
        if (!top && !isBot(l, pg)) return;
        const k = (top ? 'T' : 'B') + hfKey(l);
        if (!seen.has(k)) { seen.add(k); counts[k] = (counts[k] || 0) + 1; }
      });
    });
    const need = Math.max(2, Math.ceil(textPages.length * 0.5)),
      taken = new Set();
    if (textPages.length >= 2)
      textPages.forEach(pg => {
        const num = pages.indexOf(pg) + 1;
        pg.lines = pg.lines.filter(l => {
          const top = isTop(l, pg);
          if (!top && !isBot(l, pg)) return true;
          const k = (top ? 'T' : 'B') + hfKey(l);
          if (!(counts[k] >= need)) return true;
          if (!taken.has(k)) { taken.add(k); (top ? heads0 : foots0).push({ l, num, pg }); }
          return false;
        });
      });
    const allLines = textPages.flatMap(p => p.lines);
    const hfXml = list => {
      if (!list.length || list.length > 3) return '';
      const sorted = list.slice().sort((a, b) => a.l.y - b.l.y);
      return sorted.map(({ l, num }, i) => {
        const al = (() => { const cx = (l.x0 + l.x1) / 2; return Math.abs(cx - PW / 2) < PW * 0.04 ? 'center' : l.x0 > PW * 0.55 ? 'right' : 'left'; })();
        const runs = [];
        flatRuns(l).forEach(r => {
          const m = String(r.t).match(new RegExp('^(.*?)\\b' + num + '\\b(.*)$'));
          if (m && !runs.some(x => x.field)) {
            if (m[1]) runs.push({ ...r, t: m[1] });
            runs.push({ ...r, t: String(num), field: true });
            if (m[2]) runs.push({ ...r, t: m[2] });
          } else runs.push(r);
        });
        return paraXml({ runs, align: al, pitch: Math.max(8, l.fs * 1.2), left: al === 'left' ? Math.max(0, l.x0 - L) : 0, tabs: l.segs.length > 1 ? l.segs.slice(1).map(s => s.x0 - L) : null, before: i ? sorted[i].l.y - sorted[i - 1].l.y - l.fs * 1.2 : 0 });
      }).join('');
    };
    // ---- scanned pages: read the words with OCR ----
    const scans = pages.map((p, i) => (p.chars < 15 ? i : -1)).filter(i => i >= 0);
    if (scans.length) {
      const lim = Math.min(scans.length, 15);
      for (let s = 0; s < lim; s++) {
        msg('Page ' + (scans[s] + 1) + ' is a scan, reading its words with OCR…');
        const c = await Lib.pdfPageToCanvas(pdf, scans[s] + 1, 1800),
          t = await ocrCanvas(c, s, lim);
        pages[scans[s]].ocr = t
          .split(/\n\s*\n/)
          .map(x => x.replace(/\s*\n\s*/g, ' ').trim())
          .filter(Boolean);
      }
      doc_note = 'Scanned pages were read with OCR, so please proofread them.' + (scans.length > lim ? ' Only the first ' + lim + ' scanned pages were read.' : '');
    }
    if (!allLines.length && !pages.some(p => p.ocr && p.ocr.length)) throw new Error('I could not find any text in this PDF.');
    // ---- page-wide measurements ----
    const sizes = {};
    allLines.forEach(l => (sizes[Math.round(l.fs * 2) / 2] = (sizes[Math.round(l.fs * 2) / 2] || 0) + l.chars));
    const body = +Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a])[0] || 11,
      heads = [];
    Object.keys(sizes).map(Number).filter(s => s >= body * 1.18).sort((a, b) => b - a).forEach(s => { if (!heads.some(h => Math.abs(h - s) < 0.9)) heads.push(s); });
    const L = Math.max(18, Math.min(150, percentile(allLines.map(l => l.x0), 0.06) || 72)),
      R = Math.min(PW - 18, Math.max(L + 200, percentile(allLines.map(l => l.x1), 0.94) || PW - 72)),
      pit0 = body * 1.2,
      T = Math.max(18, Math.min(150, percentile(textPages.filter(p => p.lines.length).map(p => p.lines[0].y - 0.85 * pit0), 0.2) || 72)),
      B = Math.max(18, Math.min(150, PH - (percentile(textPages.filter(p => p.lines.length).map(p => p.lines[p.lines.length - 1].y + 0.3 * p.lines[p.lines.length - 1].fs), 0.92) || PH - 72) - 8));
    const st = { L, R, body, heads },
      media = [];
    let xmlBody = '',
      mid = 0;
    const spacer = (pb, before) => '<w:p><w:pPr>' + (pb ? '<w:pageBreakBefore/>' : '') + '<w:spacing w:before="' + tw(Math.max(0, before)) + '" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi];
      msg('Building page ' + (pi + 1) + ' of ' + pages.length + '…');
      if (pg.chars < 15) {
        (pg.ocr || []).forEach((t, k) => {
          xmlBody += paraXml({ runs: [{ t, font: 'Calibri', hp: 22, b: false, i: false }], pageBreak: pi > 0 && k === 0, before: 6 });
        });
        continue;
      }
      const { blocks, floats } = layoutPdfPage(pg, st);
      // a page that has pictures starts with the picture paragraph, which already breaks to the new page
      const picsFirst = pi > 0 && floats.some(f => f.im && f.im.cv);
      // 1) the text and tables of the page, in order
      const items = [];
      let prevBottom = null;
      for (let bi = 0; bi < blocks.length; bi++) {
        const b = blocks[bi],
          pb = pi > 0 && bi === 0 && !picsFirst;
        if (b.kind === 'p') {
          const p = b.p;
          p.pageBreak = pb;
          p.before = prevBottom === null ? p.lines[0].y - 0.85 * p.pitch - T : p.lines[0].y - prevBottom - p.pitch;
          items.push({ top: b.top, bottom: b.bottom, fs: p.lines[p.lines.length - 1].fs, xml: paraXml(p) });
          prevBottom = b.bottom;
        } else {
          const xml = pb || prevBottom === null ? spacer(pb, b.top - T) : spacer(false, b.top - prevBottom - 8) + '';
          items.push({ top: b.top, bottom: b.bottom, fs: 0, xml: xml + tableXml(b.tb) });
          prevBottom = b.bottom;
        }
      }
      // 2) the pictures: each one is fixed to the text right above it, so it moves with that text
      const pageFixed = [],
        after = {};
      let pz = 0;
      for (const fl of floats) {
        const c = fl.im.cv || null;
        if (!c) continue;
        const pic = await canvasPicture(c),
          id = ++mid;
        media.push({ id, ext: pic.ext, data: pic.data });
        let host = -1;
        if (false) {
          items.forEach((it, j) => {
            if (it.top <= fl.im.y + 1 && it.bottom <= fl.im.y + 2 && it.fs) host = j;
          });
        }
        if (host >= 0) {
          const it = items[host],
            off = fl.im.y - it.bottom - 0.3 * it.fs;
          const run = anchorXml({ x: fl.im.x, y: off, w: fl.im.w, h: fl.im.h, ext: pic.ext }, id, 'tb', ++pz, false, 'paragraph');
          after[host] = (after[host] || '') + run;
        } else {
          pageFixed.push({ x: fl.im.x, y: fl.im.y, w: fl.im.w, h: fl.im.h, ext: pic.ext, id, wrap: 'none' });
        }
      }
      let anchors = '';
      pageFixed.forEach(pf => {
        anchors += anchorXml({ x: pf.x, y: pf.y, w: pf.w, h: pf.h, ext: pf.ext }, pf.id, pf.wrap, ++pz, false, 'page');
      });
      if (anchors) xmlBody += '<w:p><w:pPr>' + (pi > 0 ? '<w:pageBreakBefore/>' : '') + '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>' + anchors + '</w:p>';
      else if (pi > 0 && items.length && !items[0].xml.includes('pageBreakBefore')) {
        /* the page starts with text: its own page break is set on the first block */
      }
      items.forEach((it, j) => {
        xmlBody += it.xml;
        if (after[j]) xmlBody += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="2" w:lineRule="exact"/></w:pPr>' + after[j] + '</w:p>';
      });
      bar(50 + Math.round(((pi + 1) / pages.length) * 40));
      await tick();
    }
    if (pdf.numPages > n) doc_note = (doc_note ? doc_note + ' ' : '') + 'Only the first ' + n + ' pages were converted.';
    const hdr = hfXml(heads0),
      ftr = hfXml(foots0),
      hd0 = heads0.length ? Math.max(8, Math.min(heads0[0].l.y - heads0[0].l.fs * 0.85, 80)) : 0,
      ft0 = foots0.length ? Math.max(8, Math.min(PH - Math.max(...foots0.map(x => x.l.y)) - 2, 80)) : 0;
    return buildDocx({ body: xmlBody, media, hdr, ftr, pg: { w: PW, h: PH, t: T, b: B, l: L, r: Math.max(18, PW - R), hd: hd0, ft: ft0 } });
  };

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
    if (kind === 'pdf' && target === 'docx') {
      msg('Reading your PDF…');
      out.push({ name: base(f.name) + '.docx', blob: await pdfToDocx(f) });
      return out;
    }
    if (kind === 'pptx' && target === 'docx') {
      msg('Opening your slides…');
      bar(5);
      out.push({ name: base(f.name) + '.docx', blob: await pptxToDocx(f) });
      return out;
    }
    if (kind === 'pptx' && target === 'pdf') {
      msg('Opening your slides…');
      bar(5);
      out.push({ name: base(f.name) + '.pdf', blob: await pptxToPdfExact(f) });
      return out;
    }
    if (kind === 'docx' && target === 'pdf') {
      msg('Opening your Word file…');
      bar(5);
      out.push({ name: base(f.name) + '.pdf', blob: await docxToPdfExact(f) });
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
  window.FC = { docToDocx, docToPdf, docToTxt, imagesToPdf, docxToPdfExact, pptxToPdfExact, pptxToDocx, pptOpen, prepareDocx, placeAnchors, pdfToDocx, readPdfPage, layoutPdfPage };
  emptyOut();
  drawFiles();
})();
