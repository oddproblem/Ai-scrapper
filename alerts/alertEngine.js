import nodemailer from 'nodemailer';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Filter opportunities based on user's alert preferences.
 */
function filterForUser(opportunities, userAlerts) {
  let filtered = [...opportunities];

  // Filter by types if user specified any
  if (userAlerts.types && userAlerts.types.length > 0) {
    filtered = filtered.filter(o => userAlerts.types.includes(o.type));
  }

  // Filter by sources if user specified any
  if (userAlerts.sources && userAlerts.sources.length > 0) {
    filtered = filtered.filter(o => userAlerts.sources.includes(o.source));
  }

  // Filter by keywords if user specified any
  if (userAlerts.keywords && userAlerts.keywords.trim()) {
    const keywords = userAlerts.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.length > 0) {
      filtered = filtered.filter(o => {
        const text = `${o.title} ${o.description || ''} ${(o.tags || []).join(' ')}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });
    }
  }

  return filtered;
}

/**
 * Build HTML email for a set of opportunities.
 */
function buildEmailHtml(opportunities, userName) {
  const typeColors = {
    hackathon: '#4A7FC4',
    accelerator: '#7C5BAD',
    grant: '#4CAF78',
    challenge: '#D4854A',
    incubator: '#4A9B9B',
    program: '#8B6F4E',
    other: '#999',
  };

  const cardRows = opportunities
    .map((opp) => {
      const color = typeColors[opp.type] || '#999';
      const deadline = opp.deadline
        ? new Date(opp.deadline).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'No deadline';
      const tags = (opp.tags || []).slice(0, 4).join(' · ');

      return `
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #f0e6d9;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: ${color}22; color: ${color}; font-size: 12px; font-weight: 600; text-transform: uppercase; white-space: nowrap;">
                ${opp.type}
              </span>
              <div>
                <a href="${opp.sourceUrl}" style="font-size: 16px; font-weight: 600; color: #3D2C1E; text-decoration: none;">
                  ${opp.title}
                </a>
                <div style="font-size: 13px; color: #8B6F4E; margin-top: 4px;">
                  ${opp.source} · ${deadline} ${tags ? `· ${tags}` : ''}
                </div>
              </div>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  return `
    <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #FEF7ED;">
      <div style="background: linear-gradient(135deg, #C4603C, #D4854A); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Opportunities Found</h1>
        <p style="color: #FFE4D4; margin: 8px 0 0; font-size: 14px;">
          Hi ${userName}, ${opportunities.length} new opportunit${opportunities.length === 1 ? 'y' : 'ies'} matching your preferences
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background: white; border: 1px solid #f0e6d9;">
        ${cardRows}
      </table>
      <div style="padding: 20px; text-align: center; font-size: 12px; color: #A89080;">
        Startup Aggregator · Automated alert · ${new Date().toLocaleDateString('en-IN')}
      </div>
    </div>`;
}

/**
 * Sends personalized alert emails to all users who have alerts enabled.
 * Filters opportunities based on each user's preferences.
 */
export async function sendAlertDigest(newOpportunities) {
  const transport = getTransporter();
  if (!transport) {
    logger.info('[Alerts] SMTP not configured — skipping email alerts');
    return;
  }

  if (!newOpportunities.length) return;

  // Find all users with alerts enabled
  const users = await User.find({ 'alerts.enabled': true }).lean();

  if (users.length === 0) {
    // Fallback: send to ALERT_RECIPIENTS env var if no users have alerts configured
    const fallbackRecipients = process.env.ALERT_RECIPIENTS;
    if (fallbackRecipients) {
      const html = buildEmailHtml(newOpportunities, 'Admin');
      await transport.sendMail({
        from: `"Startup Aggregator" <${process.env.SMTP_USER}>`,
        to: fallbackRecipients,
        subject: `${newOpportunities.length} New Startup Opportunities Found`,
        html,
      });
      logger.info(`[Alerts] Fallback digest sent to ${fallbackRecipients}`);
    } else {
      logger.info('[Alerts] No users with alerts enabled and no fallback recipients');
    }
    return;
  }

  // Send personalized emails to each user
  let sent = 0;
  for (const user of users) {
    const filtered = filterForUser(newOpportunities, user.alerts);

    if (filtered.length === 0) {
      logger.info(`[Alerts] No matching opportunities for ${user.email}, skipping`);
      continue;
    }

    const html = buildEmailHtml(filtered, user.displayName || 'there');

    try {
      await transport.sendMail({
        from: `"Startup Aggregator" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `${filtered.length} New Startup Opportunities Found`,
        html,
      });
      sent++;
      logger.info(`[Alerts] Sent ${filtered.length} items to ${user.email}`);
    } catch (err) {
      logger.error(`[Alerts] Failed to send to ${user.email}: ${err.message}`);
    }
  }

  logger.info(`[Alerts] Digest emails sent to ${sent}/${users.length} users`);
}
