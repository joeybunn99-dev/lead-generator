const fs = require('fs');
const PDFDocument = require('pdfkit');

// ── Colors ──
const NAVY      = '#1a2744';
const DARK_BLUE = '#2c3e6b';
const ACCENT    = '#3b82f6';
const GREEN     = '#10b981';
const LIGHT_BG  = '#f0f4ff';
const WHITE     = '#ffffff';
const GRAY      = '#6b7280';
const DARK      = '#1f2937';
const MED_GRAY  = '#9ca3af';
const TABLE_ALT = '#f8fafc';
const GREEN_LT  = '#f0fdf4';

const LB = { lineBreak: false };
const PAGE_W = 612; // Letter width in points
const PAGE_H = 792; // Letter height in points
const LEFT = 50;
const RIGHT = PAGE_W - 50;
const CONTENT_W = RIGHT - LEFT;

function txt(doc, str, x, y, opts = {}) {
  doc.text(str, x, y, { lineBreak: false, ...opts });
}

function analyzeCSV(filePath) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.trim().split('\n').slice(1);

  let totalCalls = 0, incomingCalls = 0, outgoingCalls = 0, internalCalls = 0;
  let voicemailCalls = 0, faxCalls = 0, autoAttendant = 0;
  let forwardedCalls = 0, forwardedSeconds = 0;
  let staffAnswered = 0, staffSeconds = 0;
  let durations = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    totalCalls++;
    const parts = line.split(',');
    const duration = parts[1];
    if (!duration) continue;
    const durParts = duration.split(':').map(Number);
    const secs = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];
    const callType = parts[2];

    if (callType === 'Internal') { internalCalls++; continue; }
    if (callType === 'Outgoing') { outgoingCalls++; continue; }
    incomingCalls++;

    const isForwarded = line.includes('Forwarded Call:');
    const isVoicemail = line.includes('Voicemail');
    const isFax = line.includes('fax') || line.includes('Fax');
    const isAutoAtt = line.includes('Auto Attendant');
    const isExtension = /,Extension \d/.test(line);

    if (isForwarded) {
      forwardedCalls++; forwardedSeconds += secs; durations.push(secs);
    } else if (isVoicemail) { voicemailCalls++; }
    else if (isFax) { faxCalls++; }
    else if (isAutoAtt) { autoAttendant++; }
    else if (isExtension) { staffAnswered++; staffSeconds += secs; }
  }

  let aiCalls = forwardedCalls;
  let aiSeconds = forwardedSeconds;

  if (forwardedCalls === 0) {
    aiCalls = autoAttendant + staffAnswered;
    aiSeconds = staffSeconds + (autoAttendant * 45);
    for (let i = 0; i < autoAttendant; i++) durations.push(45);
  }

  const aiMinutes = aiSeconds / 60;
  const avgCallSec = aiCalls > 0 ? aiSeconds / aiCalls : 0;

  const u10 = durations.filter(d => d < 10).length;
  const s10 = durations.filter(d => d >= 10 && d < 30).length;
  const s30 = durations.filter(d => d >= 30 && d < 60).length;
  const m1 = durations.filter(d => d >= 60 && d < 120).length;
  const m2 = durations.filter(d => d >= 120).length;

  const retellPerMin = 0.0885;
  const retellTotal = aiMinutes * retellPerMin;
  const deepgramTotal = aiMinutes * 0.0059;
  const elevenTotal = aiMinutes * 0.024;
  const claudeTotal = aiCalls * 0.003;
  const joshuaTotal = deepgramTotal + elevenTotal + claudeTotal;

  return {
    totalCalls, incomingCalls, outgoingCalls, internalCalls,
    voicemailCalls, faxCalls, autoAttendant, forwardedCalls,
    staffAnswered, aiCalls, aiMinutes, avgCallSec,
    durationBuckets: { u10, s10, s30, m1, m2 },
    retellTotal, joshuaTotal, deepgramTotal, elevenTotal, claudeTotal, retellPerMin,
    savings: retellTotal - joshuaTotal,
    savingsPct: retellTotal > 0 ? ((1 - joshuaTotal / retellTotal) * 100) : 0,
  };
}

// ── Drawing helpers ──

function drawHeader(doc) {
  doc.save();
  doc.rect(0, 0, PAGE_W, 72).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(20).fill(WHITE);
  txt(doc, 'AI Voice Agent  ', LEFT, 20);
  // Measure first part width to position second part
  const w1 = doc.widthOfString('AI Voice Agent  ');
  doc.fill(ACCENT);
  txt(doc, 'Cost Analysis', LEFT + w1, 20);
  doc.font('Helvetica').fontSize(9).fill(MED_GRAY);
  txt(doc, 'Prepared by Bunn Communications  |  March 2026', LEFT, 48);
  doc.restore();
}

function drawFooter(doc, pageNum) {
  doc.save();
  const y = PAGE_H - 36;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(MED_GRAY).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(8).fill(MED_GRAY);
  txt(doc, 'Bunn Communications  |  Confidential', LEFT, y + 8);
  txt(doc, 'Page ' + pageNum, RIGHT - 40, y + 8);
  doc.restore();
}

function drawSectionBar(doc, y, title) {
  doc.save();
  doc.rect(LEFT, y, CONTENT_W, 24).fill(DARK_BLUE);
  doc.font('Helvetica-Bold').fontSize(10).fill(WHITE);
  txt(doc, title, LEFT + 10, y + 7);
  doc.restore();
  return y + 32;
}

function drawKpiBox(doc, x, y, w, label, value, color) {
  doc.save();
  doc.roundedRect(x, y, w, 50, 3).fill(LIGHT_BG);
  doc.font('Helvetica').fontSize(7).fill(GRAY);
  txt(doc, label, x + 8, y + 8);
  doc.font('Helvetica-Bold').fontSize(16).fill(color || DARK);
  txt(doc, value, x + 8, y + 24);
  doc.restore();
}

function drawTableRow(doc, y, cols, values, opts = {}) {
  doc.save();
  const rowH = 20;
  const bg = opts.bg || WHITE;
  const totalW = cols.reduce((a, c) => a + c.w, 0);

  doc.rect(LEFT, y, totalW, rowH).fill(bg);

  let cx = LEFT;
  cols.forEach((col, i) => {
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const color = opts.headerRow ? WHITE : (opts.bold ? DARK : (i === 0 ? DARK : GRAY));
    doc.font(font).fontSize(8.5).fill(color);
    const align = i === 0 ? 'left' : 'right';
    txt(doc, values[i] || '', cx + 6, y + 5, { width: col.w - 12, align });
    cx += col.w;
  });

  doc.restore();
  return y + rowH;
}

function drawTableHeader(doc, y, cols, headers) {
  doc.save();
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  doc.rect(LEFT, y, totalW, 20).fill(DARK_BLUE);

  let cx = LEFT;
  cols.forEach((col, i) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fill(WHITE);
    const align = i === 0 ? 'left' : 'right';
    txt(doc, headers[i], cx + 6, y + 5, { width: col.w - 12, align });
    cx += col.w;
  });

  doc.restore();
  return y + 20;
}

function drawBottomLine(doc, y, cols) {
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  doc.save();
  doc.moveTo(LEFT, y).lineTo(LEFT + totalW, y).strokeColor(MED_GRAY).lineWidth(0.5).stroke();
  doc.restore();
}

// ── Main page drawing ──

function drawBusinessPage(doc, businessName, subtitle, data, pageNum) {
  drawHeader(doc);
  drawFooter(doc, pageNum);

  let y = 88;

  // Business name
  doc.font('Helvetica-Bold').fontSize(16).fill(NAVY);
  txt(doc, businessName, LEFT, y);
  y += 20;

  if (subtitle) {
    doc.font('Helvetica').fontSize(9).fill(GRAY);
    txt(doc, subtitle, LEFT, y);
    y += 14;
  }

  doc.font('Helvetica').fontSize(8).fill(MED_GRAY);
  txt(doc, 'February 2026 Call Volume  |  Data Source: CoreNexa CDR Export', LEFT, y);
  y += 20;

  // ── KPI Boxes ──
  const boxGap = 10;
  const boxW = (CONTENT_W - boxGap * 3) / 4;
  const avgDur = Math.floor(data.avgCallSec / 60) + 'm ' + Math.round(data.avgCallSec % 60) + 's';

  drawKpiBox(doc, LEFT, y, boxW, 'TOTAL CALLS', data.totalCalls.toLocaleString(), NAVY);
  drawKpiBox(doc, LEFT + boxW + boxGap, y, boxW, 'AI-ELIGIBLE CALLS', data.aiCalls.toLocaleString(), ACCENT);
  drawKpiBox(doc, LEFT + (boxW + boxGap) * 2, y, boxW, 'AI MINUTES', data.aiMinutes.toFixed(0), ACCENT);
  drawKpiBox(doc, LEFT + (boxW + boxGap) * 3, y, boxW, 'AVG DURATION', avgDur, DARK);
  y += 60;

  // ── Call Breakdown ──
  y = drawSectionBar(doc, y, 'Call Breakdown');
  const bCols = [{ w: 250 }, { w: 130 }];
  y = drawTableHeader(doc, y, bCols, ['Category', 'Count']);

  const bRows = [];
  bRows.push(['Incoming Calls', data.incomingCalls.toLocaleString()]);
  if (data.forwardedCalls > 0) bRows.push(['   Forwarded to AI Agent', data.forwardedCalls.toLocaleString()]);
  if (data.autoAttendant > 0) bRows.push(['   Auto Attendant', data.autoAttendant.toLocaleString()]);
  if (data.staffAnswered > 0) bRows.push(['   Staff Answered', data.staffAnswered.toLocaleString()]);
  if (data.voicemailCalls > 0) bRows.push(['   Voicemail', data.voicemailCalls.toLocaleString()]);
  if (data.outgoingCalls > 0) bRows.push(['Outgoing Calls', data.outgoingCalls.toLocaleString()]);
  if (data.internalCalls > 0) bRows.push(['Internal Calls', data.internalCalls.toLocaleString()]);

  bRows.forEach((row, i) => {
    y = drawTableRow(doc, y, bCols, row, { bg: i % 2 === 0 ? WHITE : TABLE_ALT });
  });
  drawBottomLine(doc, y, bCols);
  y += 10;

  // ── Duration Distribution ──
  y = drawSectionBar(doc, y, 'Call Duration Distribution');
  const dCols = [{ w: 150 }, { w: 80 }, { w: 80 }, { w: 120 }];
  y = drawTableHeader(doc, y, dCols, ['Duration', 'Calls', '% of Total', 'Description']);

  const db = data.durationBuckets;
  const total = db.u10 + db.s10 + db.s30 + db.m1 + db.m2;
  const pct = (v) => total > 0 ? (v / total * 100).toFixed(0) + '%' : '0%';
  const dRows = [
    ['Under 10 seconds', db.u10.toString(), pct(db.u10), 'Hangups / Spam'],
    ['10 - 30 seconds', db.s10.toString(), pct(db.s10), 'Quick inquiries'],
    ['30 sec - 1 minute', db.s30.toString(), pct(db.s30), 'Standard calls'],
    ['1 - 2 minutes', db.m1.toString(), pct(db.m1), 'Detailed calls'],
    ['Over 2 minutes', db.m2.toString(), pct(db.m2), 'Extended calls'],
  ];
  dRows.forEach((row, i) => {
    y = drawTableRow(doc, y, dCols, row, { bg: i % 2 === 0 ? WHITE : TABLE_ALT });
  });
  drawBottomLine(doc, y, dCols);
  y += 10;

  // ── Cost Comparison ──
  y = drawSectionBar(doc, y, 'Monthly Cost Comparison');
  const cCols = [{ w: 200 }, { w: 130 }, { w: 130 }];
  y = drawTableHeader(doc, y, cCols, ['Service', 'Retell AI', 'Joshua AI']);

  const costRows = [
    { vals: ['Speech-to-Text (Deepgram)', 'Included', '$' + data.deepgramTotal.toFixed(2)] },
    { vals: ['Text-to-Speech (ElevenLabs)', 'Included', '$' + data.elevenTotal.toFixed(2)] },
    { vals: ['LLM (Claude Sonnet)', 'Included', '$' + data.claudeTotal.toFixed(2)] },
    { vals: ['Monthly Total', '$' + data.retellTotal.toFixed(2), '$' + data.joshuaTotal.toFixed(2)], bold: true, bg: GREEN_LT },
    { vals: ['Effective Rate', '$' + data.retellPerMin.toFixed(4) + '/min', '$' + (data.aiMinutes > 0 ? (data.joshuaTotal / data.aiMinutes).toFixed(4) : '0.0000') + '/min'] },
  ];
  costRows.forEach((row, i) => {
    const bg = row.bg || (i % 2 === 0 ? WHITE : TABLE_ALT);
    y = drawTableRow(doc, y, cCols, row.vals, { bg, bold: row.bold });
  });
  drawBottomLine(doc, y, cCols);
  y += 14;

  // ── Savings callout ──
  doc.save();
  doc.roundedRect(LEFT, y, CONTENT_W, 42, 4).fill(GREEN_LT);
  doc.rect(LEFT, y, 4, 42).fill(GREEN);

  doc.font('Helvetica-Bold').fontSize(13).fill(GREEN);
  txt(doc, '$' + data.savings.toFixed(2) + '/mo savings', LEFT + 14, y + 6);

  doc.font('Helvetica').fontSize(9).fill(DARK);
  txt(doc, data.savingsPct.toFixed(0) + '% cost reduction with Joshua AI', LEFT + 14, y + 25);

  doc.font('Helvetica-Bold').fontSize(26).fill(GREEN);
  txt(doc, data.savingsPct.toFixed(0) + '%', RIGHT - 90, y + 4, { width: 80, align: 'right' });

  doc.font('Helvetica').fontSize(7).fill(GRAY);
  txt(doc, 'CHEAPER', RIGHT - 90, y + 32, { width: 80, align: 'right' });

  doc.restore();
}

// ── Generate PDF ──
const doc = new PDFDocument({ size: 'LETTER', margin: 50, autoFirstPage: false });
const outputPath = 'C:/Users/jlb2s/Downloads/AI_Voice_Agent_Cost_Analysis.pdf';
doc.pipe(fs.createWriteStream(outputPath));

const businesses = [
  {
    file: 'C:/Users/jlb2s/Downloads/Clarity Vision Clayton Feburary Call Volume.csv',
    name: 'Clarity Vision',
    subtitle: 'Clayton, NC  |  Optometry Practice',
  },
  {
    file: 'C:/Users/jlb2s/Downloads/Clarity Vision Smithfield-Holly Springs February Call Volume.csv',
    name: 'Clarity Vision',
    subtitle: 'Smithfield & Holly Springs, NC  |  Optometry Practice',
  },
  {
    file: 'C:/Users/jlb2s/Downloads/Bateman Civil Survey February Call Volume.csv',
    name: 'Bateman Civil Survey',
    subtitle: 'Civil Engineering & Land Surveying',
  },
];

businesses.forEach((biz, i) => {
  const data = analyzeCSV(biz.file);
  doc.addPage({ size: 'LETTER', margin: 50 });
  drawBusinessPage(doc, biz.name, biz.subtitle, data, i + 1);
});

doc.end();
console.log('PDF saved to: ' + outputPath);
