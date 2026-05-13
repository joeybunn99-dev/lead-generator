const fs = require('fs');

function analyzeCSV(filePath, name) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.trim().split('\n').slice(1);

  let totalCalls = 0;
  let incomingCalls = 0;
  let outgoingCalls = 0;
  let internalCalls = 0;
  let voicemailCalls = 0;
  let faxCalls = 0;
  let autoAttendant = 0;
  let forwardedCalls = 0;
  let forwardedSeconds = 0;
  let staffAnswered = 0;
  let staffSeconds = 0;
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

    const isVoicemail = line.includes('Voicemail');
    const isFax = line.includes('fax') || line.includes('Fax');
    const isAutoAtt = line.includes('Auto Attendant');
    const isForwarded = line.includes('Forwarded Call:');
    const isExtension = /,Extension \d/.test(line);

    if (isForwarded) {
      forwardedCalls++;
      forwardedSeconds += secs;
      durations.push(secs);
    } else if (isVoicemail) {
      voicemailCalls++;
    } else if (isFax) {
      faxCalls++;
    } else if (isAutoAtt) {
      autoAttendant++;
    } else if (isExtension) {
      staffAnswered++;
      staffSeconds += secs;
    }
  }

  let aiCalls = forwardedCalls;
  let aiSeconds = forwardedSeconds;
  let aiSource = 'forwarded';

  if (forwardedCalls === 0) {
    aiCalls = autoAttendant + staffAnswered;
    aiSeconds = staffSeconds + (autoAttendant * 45);
    aiSource = 'auto-attendant + staff';
    // Build durations estimate
    for (let i = 0; i < autoAttendant; i++) durations.push(45);
  }

  const aiMinutes = aiSeconds / 60;
  const avgCallSec = aiCalls > 0 ? aiSeconds / aiCalls : 0;

  // Retell pricing: $0.0885/min (Bunn actual verified rate)
  const retellPerMin = 0.0885;
  const retellTotal = aiMinutes * retellPerMin;

  // Joshua cloud pricing
  const deepgramTotal = aiMinutes * 0.0059;
  const elevenTotal = aiMinutes * 0.024;
  const claudeTotal = aiCalls * 0.003;
  const joshuaTotal = deepgramTotal + elevenTotal + claudeTotal;

  // Joshua self-hosted TTS
  const joshuaSelfHosted = deepgramTotal + claudeTotal;

  console.log('');
  console.log('===================================================');
  console.log('  ' + name);
  console.log('===================================================');
  console.log('');
  console.log('CALL VOLUME:');
  console.log('  Total calls:       ' + totalCalls);
  console.log('  Incoming:          ' + incomingCalls);
  console.log('  Outgoing:          ' + outgoingCalls);
  console.log('  Internal:          ' + internalCalls);
  console.log('');
  console.log('INCOMING BREAKDOWN:');
  console.log('  Forwarded (AI):    ' + forwardedCalls);
  console.log('  Auto Attendant:    ' + autoAttendant);
  console.log('  Staff answered:    ' + staffAnswered);
  console.log('  Voicemail:         ' + voicemailCalls);
  console.log('  Fax:               ' + faxCalls);
  console.log('');
  console.log('AI AGENT VOLUME (' + aiSource + '):');
  console.log('  Calls:             ' + aiCalls);
  console.log('  Total minutes:     ' + aiMinutes.toFixed(1));
  console.log('  Avg call duration: ' + avgCallSec.toFixed(0) + 's');

  if (durations.length > 0) {
    const u10 = durations.filter(d => d < 10).length;
    const s10 = durations.filter(d => d >= 10 && d < 30).length;
    const s30 = durations.filter(d => d >= 30 && d < 60).length;
    const m1 = durations.filter(d => d >= 60 && d < 120).length;
    const m2 = durations.filter(d => d >= 120).length;
    console.log('  Duration spread:   <10s:' + u10 + '  10-30s:' + s10 + '  30s-1m:' + s30 + '  1-2m:' + m1 + '  >2m:' + m2);
  }

  console.log('');
  console.log('MONTHLY COST:');
  console.log('                     Retell     Joshua     Joshua+LocalTTS');
  console.log('  STT (Deepgram)     included   $' + deepgramTotal.toFixed(2).padStart(6) + '    $' + deepgramTotal.toFixed(2).padStart(6));
  console.log('  TTS (ElevenLabs)   included   $' + elevenTotal.toFixed(2).padStart(6) + '    $  0.00');
  console.log('  LLM (Claude)       included   $' + claudeTotal.toFixed(2).padStart(6) + '    $' + claudeTotal.toFixed(2).padStart(6));
  console.log('  -----------------------------------------------');
  console.log('  TOTAL              $' + retellTotal.toFixed(2).padStart(7) + '  $' + joshuaTotal.toFixed(2).padStart(6) + '    $' + joshuaSelfHosted.toFixed(2).padStart(6));
  console.log('  Per minute         $' + retellPerMin.toFixed(4) + '  $' + (aiMinutes > 0 ? (joshuaTotal/aiMinutes).toFixed(4) : '0.0000') + '    $' + (aiMinutes > 0 ? (joshuaSelfHosted/aiMinutes).toFixed(4) : '0.0000'));
  console.log('  Savings vs Retell           ' + (retellTotal > 0 ? ((1 - joshuaTotal/retellTotal) * 100).toFixed(0) : 0) + '%         ' + (retellTotal > 0 ? ((1 - joshuaSelfHosted/retellTotal) * 100).toFixed(0) : 0) + '%');

  return { name, aiCalls, aiMinutes, retellTotal, joshuaTotal, joshuaSelfHosted };
}

const results = [];
results.push(analyzeCSV('C:/Users/jlb2s/Downloads/Clarity Vision Clayton Feburary Call Volume.csv', 'CLARITY VISION - CLAYTON'));
results.push(analyzeCSV('C:/Users/jlb2s/Downloads/Clarity Vision Smithfield-Holly Springs February Call Volume.csv', 'CLARITY VISION - SMITHFIELD / HOLLY SPRINGS'));
results.push(analyzeCSV('C:/Users/jlb2s/Downloads/Bateman Civil Survey February Call Volume.csv', 'BATEMAN CIVIL SURVEY'));

console.log('');
console.log('===================================================');
console.log('  COMBINED TOTALS (ALL 3 BUSINESSES)');
console.log('===================================================');
const totCalls = results.reduce((s,r) => s + r.aiCalls, 0);
const totMin = results.reduce((s,r) => s + r.aiMinutes, 0);
const totRetell = results.reduce((s,r) => s + r.retellTotal, 0);
const totJoshua = results.reduce((s,r) => s + r.joshuaTotal, 0);
const totSelf = results.reduce((s,r) => s + r.joshuaSelfHosted, 0);
console.log('  Total AI calls:     ' + totCalls);
console.log('  Total AI minutes:   ' + totMin.toFixed(1));
console.log('  Retell total:       $' + totRetell.toFixed(2) + '/mo');
console.log('  Joshua (cloud):     $' + totJoshua.toFixed(2) + '/mo  (saves $' + (totRetell - totJoshua).toFixed(2) + ')');
console.log('  Joshua (local TTS): $' + totSelf.toFixed(2) + '/mo  (saves $' + (totRetell - totSelf).toFixed(2) + ')');
console.log('');
console.log('  Per-client avg:');
console.log('    Retell:       $' + (totRetell/3).toFixed(2) + '/mo');
console.log('    Joshua cloud: $' + (totJoshua/3).toFixed(2) + '/mo');
console.log('    Joshua local: $' + (totSelf/3).toFixed(2) + '/mo');
console.log('');
