const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { query, queryOne, run } = require('../database');

// ═══════════════════════════════════════════════════════════════════
// LOCKDOWN: All email sending is DISABLED until legal compliance
// is verified. This was locked on April 2, 2026 due to TCPA/CAN-SPAM
// concerns. The database and read operations still work — only
// sending is blocked. Remove this guard ONLY after compliance review.
// ═══════════════════════════════════════════════════════════════════
const SENDING_LOCKED = true;
const LOCKDOWN_REASON = 'Email sending disabled pending legal compliance review (TCPA April 11, 2026 rule change). Contact operations are read-only.';

// --- SMTP Setup ---
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'jxbunn@bunncom.com',
      pass: process.env.SMTP_PASS,
    },
  });
}

// --- Email Templates ---
const TEMPLATES = {
  'free-audit': {
    name: 'Free Phone Bill Audit',
    subject: 'Quick question about your phone service',
    body: `Hi {{company_name}},

I'm Joshua with Bunn Communications here in North Carolina. We've been helping local businesses with their phone and IT systems since 1985.

I wanted to reach out because we've been saving businesses like yours 30-50% on their monthly phone bills by switching to modern VoIP. No contracts, no hidden fees.

Would you be open to a free 5-minute review of what you're currently paying? No strings attached — if we can't save you money, we'll tell you.

You can reach me at 919-773-6114 or just reply to this email.

Best,
Joshua Bunn
Bunn Communications, Inc.
919-773-6114 | bunncom.com`,
  },

  'local-intro': {
    name: 'Local Introduction',
    subject: 'Fellow NC business saying hello',
    body: `Hi {{company_name}},

I'm Joshua with Bunn Communications — we're a family-owned IT and phone company based right here in North Carolina, been around since 1985.

I noticed your business is in {{city}} and wanted to introduce ourselves. We work with a lot of local companies on VoIP phone systems, security cameras, and network management.

No sales pitch here — just wanted you to know we exist if you ever need a second opinion on your phone system, internet setup, or office security. We're always happy to help a fellow NC business.

Have a great day,
Joshua Bunn
Bunn Communications, Inc.
919-773-6114 | bunncom.com`,
  },

  'savings-calculator': {
    name: 'Savings Calculator',
    subject: 'How much could {{company_name}} save on phone service?',
    body: `Hi {{company_name}},

We built a free tool that shows businesses exactly how much they could save by switching to VoIP. It takes about 30 seconds:

https://bunncom.com/#calculator

Most of the NC businesses we work with save between $200-$500/month — and that's with better call quality, mobile apps, and features like auto-attendant included.

If you're curious, give it a try. No sign-up required.

And if you'd rather just talk to a person, I'm always here: 919-773-6114.

Best,
Joshua Bunn
Bunn Communications, Inc.
919-773-6114 | bunncom.com`,
  },

  'security-cameras': {
    name: 'Security Camera Offer',
    subject: 'Is your business protected?',
    body: `Hi {{company_name}},

I'm Joshua with Bunn Communications in North Carolina. I wanted to reach out because we've been helping local businesses upgrade their security camera systems.

We install commercial-grade 4K camera systems with remote viewing from your phone, night vision, and AI-powered alerts — all with a 6-year warranty and no monthly monitoring fees.

If you've been thinking about adding cameras or upgrading an older system, I'd be happy to do a free walkthrough of your space and put together a quote. No pressure at all.

Give me a call at 919-773-6114 or reply here.

Best,
Joshua Bunn
Bunn Communications, Inc.
919-773-6114 | bunncom.com`,
  },
};

// --- CAN-SPAM Footer ---
const CAN_SPAM_FOOTER = `

---
Bunn Communications, Inc. | Bunn, North Carolina
You're receiving this because your business is listed publicly in North Carolina.
To stop receiving emails from us, reply with "unsubscribe" or click here:
{{unsubscribe_url}}`;

// --- Template Variable Replacement ---
function fillTemplate(template, data) {
  let text = template;
  text = text.replace(/\{\{company_name\}\}/g, data.company_name || 'there');
  text = text.replace(/\{\{city\}\}/g, data.city || 'North Carolina');
  text = text.replace(/\{\{email\}\}/g, data.email || '');
  text = text.replace(/\{\{unsubscribe_url\}\}/g,
    `${process.env.BASE_URL || 'http://localhost:3000'}/unsubscribe?token=${data.unsubscribe_token || ''}`
  );
  return text;
}

// --- Generate unsubscribe token ---
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ============ API Routes ============

// GET /api/campaigns — list all campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_emails WHERE campaign_id = c.id) as total_emails,
        (SELECT COUNT(*) FROM campaign_emails WHERE campaign_id = c.id AND sent_at IS NOT NULL) as sent_count,
        (SELECT COUNT(*) FROM campaign_emails WHERE campaign_id = c.id AND opened_at IS NOT NULL) as opened_count,
        (SELECT COUNT(*) FROM campaign_emails WHERE campaign_id = c.id AND replied = 1) as replied_count
      FROM campaigns c ORDER BY c.created_at DESC
    `);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/templates — get available templates
router.get('/campaigns/templates', (req, res) => {
  const list = Object.entries(TEMPLATES).map(([id, t]) => ({
    id, name: t.name, subject: t.subject, preview: t.body.slice(0, 150) + '...',
  }));
  res.json(list);
});

// POST /api/campaigns — create a new campaign
router.post('/campaigns', async (req, res) => {
  // LOCKDOWN CHECK — blocks campaign creation
  if (SENDING_LOCKED) {
    return res.status(403).json({ error: LOCKDOWN_REASON, locked: true });
  }

  try {
    const { name, template_id, custom_subject, custom_body, filters } = req.body;

    if (!name) return res.status(400).json({ error: 'Campaign name required' });

    const template = TEMPLATES[template_id];
    const subject = custom_subject || (template ? template.subject : 'Hello from Bunn Communications');
    const body = custom_body || (template ? template.body : '');

    // Create campaign
    const result = await run(`
      INSERT INTO campaigns (name, template_id, subject, body, status)
      VALUES (?, ?, ?, ?, 'draft')
    `, [name, template_id || 'custom', subject, body + CAN_SPAM_FOOTER]);

    const campaignId = Number(result.lastInsertRowid);

    // Build recipient list based on filters
    let where = "ct.email IS NOT NULL AND ct.email != '' AND ct.email_status != 'bounced'";
    const args = [];

    if (filters) {
      if (filters.city) {
        where += ' AND co.city = ?';
        args.push(filters.city);
      }
      if (filters.industry) {
        where += ' AND co.industry LIKE ?';
        args.push(`%${filters.industry}%`);
      }
      if (filters.min_rating) {
        where += ' AND co.rating >= ?';
        args.push(filters.min_rating);
      }
      if (filters.min_lead_score) {
        where += ' AND ct.lead_score >= ?';
        args.push(filters.min_lead_score);
      }
    }

    // Exclude unsubscribed
    where += " AND ct.email NOT IN (SELECT email FROM unsubscribes)";
    // Exclude already contacted in another campaign in the last 30 days
    where += ` AND ct.id NOT IN (
      SELECT contact_id FROM campaign_emails
      WHERE sent_at > datetime('now', '-30 days')
    )`;
    // Exclude D-tier junk emails
    where += " AND (ct.email_tier IS NULL OR ct.email_tier != 'D')";

    // Filter by email tier if specified
    if (filters && filters.email_tier) {
      where += ' AND ct.email_tier = ?';
      args.push(filters.email_tier);
    }

    const recipients = await query(`
      SELECT ct.id as contact_id, ct.email, ct.name as contact_name,
             co.name as company_name, co.city, co.industry,
             ct.email_tier
      FROM contacts ct
      JOIN companies co ON ct.company_id = co.id
      WHERE ${where}
      ORDER BY
        CASE ct.email_tier
          WHEN 'A' THEN 1
          WHEN 'B' THEN 2
          WHEN 'C' THEN 3
          ELSE 4
        END,
        ct.lead_score DESC
    `, args);

    // Insert campaign emails
    for (const r of recipients) {
      const token = generateToken();
      await run(`
        INSERT INTO campaign_emails (campaign_id, contact_id, email, company_name, city, unsubscribe_token)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [campaignId, r.contact_id, r.email, r.company_name, r.city, token]);
    }

    res.json({
      id: campaignId,
      name,
      template: template_id,
      recipients: recipients.length,
      status: 'draft',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/send — start sending a campaign
router.post('/campaigns/:id/send', async (req, res) => {
  // LOCKDOWN CHECK — blocks all sending
  if (SENDING_LOCKED) {
    return res.status(403).json({ error: LOCKDOWN_REASON, locked: true });
  }

  try {
    const campaign = await queryOne('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sending') return res.status(400).json({ error: 'Already sending' });

    await run("UPDATE campaigns SET status = 'sending', started_at = datetime('now') WHERE id = ?", [campaign.id]);

    // Get unsent emails for this campaign
    const emails = await query(`
      SELECT * FROM campaign_emails
      WHERE campaign_id = ? AND sent_at IS NULL
      ORDER BY ROWID
    `, [campaign.id]);

    res.json({ message: `Sending ${emails.length} emails...`, total: emails.length });

    // Send in background (don't block the response)
    sendCampaignEmails(campaign, emails).catch(err => {
      console.error('Campaign send error:', err);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background email sender
async function sendCampaignEmails(campaign, emails) {
  const transporter = getTransporter();
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      // Fill template
      const subject = fillTemplate(campaign.subject, {
        company_name: email.company_name,
        city: email.city,
        email: email.email,
        unsubscribe_token: email.unsubscribe_token,
      });

      const body = fillTemplate(campaign.body, {
        company_name: email.company_name,
        city: email.city,
        email: email.email,
        unsubscribe_token: email.unsubscribe_token,
      });

      await transporter.sendMail({
        from: `"Joshua Bunn" <${process.env.SMTP_USER || 'jxbunn@bunncom.com'}>`,
        to: email.email,
        subject: subject,
        text: body,
      });

      await run("UPDATE campaign_emails SET sent_at = datetime('now') WHERE id = ?", [email.id]);
      sent++;

      // Rate limit: 1 email every 3 seconds (20/min, well under Office 365 limits)
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      failed++;
      await run("UPDATE campaign_emails SET error = ? WHERE id = ?", [err.message, email.id]);

      // If auth fails, stop the whole campaign
      if (err.message.includes('auth') || err.message.includes('credential')) {
        await run("UPDATE campaigns SET status = 'error', error = ? WHERE id = ?",
          ['SMTP authentication failed', campaign.id]);
        return;
      }
    }
  }

  await run(`UPDATE campaigns SET status = 'completed', finished_at = datetime('now'),
    sent_count = ?, failed_count = ? WHERE id = ?`, [sent, failed, campaign.id]);
}

// GET /api/campaigns/:id — get campaign details
router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await queryOne('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    const emails = await query(`
      SELECT ce.*, ct.name as contact_name
      FROM campaign_emails ce
      LEFT JOIN contacts ct ON ce.contact_id = ct.id
      WHERE ce.campaign_id = ?
      ORDER BY ce.sent_at DESC NULLS LAST
    `, [campaign.id]);

    const stats = {
      total: emails.length,
      sent: emails.filter(e => e.sent_at).length,
      failed: emails.filter(e => e.error).length,
      pending: emails.filter(e => !e.sent_at && !e.error).length,
    };

    res.json({ ...campaign, emails, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id — delete a draft campaign
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await queryOne('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    if (campaign.status === 'sending') return res.status(400).json({ error: 'Cannot delete while sending' });

    await run('DELETE FROM campaign_emails WHERE campaign_id = ?', [campaign.id]);
    await run('DELETE FROM campaigns WHERE id = ?', [campaign.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/preview — preview an email from a campaign
router.post('/campaigns/:id/preview', async (req, res) => {
  try {
    const campaign = await queryOne('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    const sample = await queryOne(`
      SELECT ce.*, co.city
      FROM campaign_emails ce
      LEFT JOIN contacts ct ON ce.contact_id = ct.id
      LEFT JOIN companies co ON ct.company_id = co.id
      WHERE ce.campaign_id = ?
      LIMIT 1
    `, [campaign.id]);

    if (!sample) return res.status(400).json({ error: 'No recipients' });

    const subject = fillTemplate(campaign.subject, {
      company_name: sample.company_name,
      city: sample.city,
      email: sample.email,
      unsubscribe_token: sample.unsubscribe_token,
    });

    const body = fillTemplate(campaign.body, {
      company_name: sample.company_name,
      city: sample.city,
      email: sample.email,
      unsubscribe_token: sample.unsubscribe_token,
    });

    res.json({ subject, body, to: sample.email, company: sample.company_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/stats/overview — dashboard stats
router.get('/campaigns/stats/overview', async (req, res) => {
  try {
    const total = await queryOne('SELECT COUNT(*) as c FROM campaigns');
    const totalSent = await queryOne("SELECT COUNT(*) as c FROM campaign_emails WHERE sent_at IS NOT NULL");
    const totalUnsubs = await queryOne('SELECT COUNT(*) as c FROM unsubscribes');
    const recentCampaigns = await query(`
      SELECT name, status, sent_count, created_at
      FROM campaigns ORDER BY created_at DESC LIMIT 5
    `);
    res.json({
      campaigns: total.c,
      emails_sent: totalSent.c,
      unsubscribes: totalUnsubs.c,
      recent: recentCampaigns,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
