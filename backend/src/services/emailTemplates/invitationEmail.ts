/**
 * Invitation email template (HTML + text)
 * ----------------------------------------
 * Modern, ClickUp-style transactional layout:
 *   - clean header with the brand mark,
 *   - one-line greeting + invitation summary,
 *   - clearly labeled workspace + role + inviter,
 *   - large primary "Accept invitation" CTA,
 *   - plain link fallback for clients that strip buttons,
 *   - footer with expiry + signature.
 *
 * Inline CSS only (Outlook/Gmail safe) and tested in Litmus-style
 * dark/light email clients. No external assets.
 */

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export interface InvitationEmailParams {
  workspaceName: string;
  inviterName: string;
  inviterEmail?: string | null;
  roleName: string;
  acceptUrl: string;
  expiresAt: Date | string | null;
  appName?: string;
}

export interface InvitationEmail {
  subject: string;
  html: string;
  text: string;
}

const formatExpiry = (expiresAt: Date | string | null) => {
  if (!expiresAt) return null;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export function buildInvitationEmail(
  params: InvitationEmailParams
): InvitationEmail {
  const appName = params.appName || "GestionPro";
  const workspace = escapeHtml(params.workspaceName || "votre espace de travail");
  const inviter = escapeHtml(params.inviterName || "Un administrateur");
  const role = escapeHtml(params.roleName || "Membre");
  const acceptUrl = params.acceptUrl;
  const expiry = formatExpiry(params.expiresAt);

  const subject = `${inviter} vous invite à rejoindre ${params.workspaceName} sur ${appName}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
    <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${inviter} vous a invité à rejoindre ${workspace} sur ${escapeHtml(appName)}.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px -16px rgba(15,23,42,0.16);">
            <!-- Header / brand -->
            <tr>
              <td style="padding:28px 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);text-align:center;line-height:36px;color:#ffffff;font-weight:700;font-size:14px;letter-spacing:0.04em;">
                        ${escapeHtml(appName.slice(0, 2).toUpperCase())}
                      </div>
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;font-size:14px;font-weight:600;color:#0f172a;letter-spacing:0.01em;">
                      ${escapeHtml(appName)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:24px 32px 8px;">
                <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
                  Vous êtes invité à rejoindre <span style="color:#4f46e5;">${workspace}</span>
                </h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
                  ${inviter} vous invite à collaborer sur ${escapeHtml(appName)} en tant que
                  <strong style="color:#0f172a;">${role}</strong>. Acceptez l'invitation pour créer votre compte
                  et rejoindre l'équipe.
                </p>
              </td>
            </tr>

            <!-- Detail card -->
            <tr>
              <td style="padding:20px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">
                      Détails de l'invitation
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#0f172a;">
                        <tr>
                          <td style="padding:6px 0;color:#64748b;width:120px;">Espace</td>
                          <td style="padding:6px 0;font-weight:600;">${workspace}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;">Invité par</td>
                          <td style="padding:6px 0;font-weight:600;">${inviter}${
                            params.inviterEmail
                              ? ` <span style="color:#94a3b8;font-weight:400;">&lt;${escapeHtml(
                                  params.inviterEmail
                                )}&gt;</span>`
                              : ""
                          }</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#64748b;">Rôle attribué</td>
                          <td style="padding:6px 0;">
                            <span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:rgba(99,102,241,0.12);color:#4f46e5;font-size:12px;font-weight:600;letter-spacing:0.02em;">
                              ${role}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td align="center" style="padding:28px 32px 8px;">
                <a href="${acceptUrl}"
                   style="display:inline-block;padding:14px 28px;background:linear-gradient(180deg,#6366f1 0%,#4f46e5 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 12px 24px -10px rgba(99,102,241,0.55);">
                  Accepter l'invitation
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 32px 0;font-size:13px;color:#64748b;text-align:center;line-height:1.6;">
                Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
                <a href="${acceptUrl}" style="color:#4f46e5;word-break:break-all;">${escapeHtml(acceptUrl)}</a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:28px 32px 32px;border-top:1px solid #e2e8f0;margin-top:24px;">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  ${
                    expiry
                      ? `Cette invitation expire le <strong style="color:#475569;">${escapeHtml(expiry)}</strong>.<br />`
                      : ""
                  }
                  Vous recevez cet email car ${inviter} vous a invité à rejoindre ${workspace}.
                  Si vous ne reconnaissez pas cette invitation, vous pouvez l'ignorer en toute sécurité.
                </p>
                <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">
                  — L'équipe ${escapeHtml(appName)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${inviter} vous invite à rejoindre ${params.workspaceName} sur ${appName}.`,
    "",
    `Espace de travail : ${params.workspaceName}`,
    `Invité par       : ${params.inviterName}${
      params.inviterEmail ? ` <${params.inviterEmail}>` : ""
    }`,
    `Rôle attribué    : ${params.roleName}`,
    "",
    "Accepter l'invitation :",
    acceptUrl,
    "",
    expiry ? `Cette invitation expire le ${expiry}.` : "",
    "",
    `— L'équipe ${appName}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
