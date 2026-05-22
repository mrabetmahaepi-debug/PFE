const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export interface PasswordResetEmailParams {
  resetUrl: string;
  appName?: string;
  expiresMinutes?: number;
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams) {
  const appName = params.appName || "GestionPro";
  const resetUrl = params.resetUrl;
  const expiresMinutes = params.expiresMinutes ?? 60;
  const safeUrl = escapeHtml(resetUrl);

  const subject = `${appName} — Réinitialisation de votre mot de passe`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f8fffc,#eff6ff,#f5f3ff);padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid rgba(14,165,233,.2);box-shadow:0 12px 32px rgba(15,23,42,.08);overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;text-align:center;">
          <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#14b8a6,#0ea5e9,#6366f1);color:#fff;font-weight:800;font-size:18px;line-height:48px;text-align:center;">GP</div>
          <h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Mot de passe oublié</h1>
          <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">Réinitialisez votre mot de passe sur ${escapeHtml(appName)}.</p>
        </td></tr>
        <tr><td style="padding:20px 28px 8px;text-align:center;">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(90deg,#14b8a6,#0ea5e9,#6366f1);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">Réinitialiser mon mot de passe</a>
        </td></tr>
        <tr><td style="padding:12px 28px 24px;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.5;">Ce lien expire dans ${expiresMinutes} minutes.</p>
          <p style="margin:0;font-size:12px;word-break:break-all;"><a href="${safeUrl}" style="color:#0ea5e9;">${safeUrl}</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${appName} — Réinitialisation de mot de passe`,
    "",
    "Cliquez sur le lien suivant pour définir un nouveau mot de passe :",
    resetUrl,
    "",
    `Ce lien expire dans ${expiresMinutes} minutes.`,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join("\n");

  return { subject, html, text };
}
