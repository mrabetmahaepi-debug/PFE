/**
 * Brevo invitation email smoke test. Reads backend/.env.
 * Usage: npx ts-node scripts/test-brevo-invite-email.ts recipient@example.com
 */
import {
  sendEmail,
  getEmailProviderInfo,
  getEmailTransportLogContext,
} from "../src/services/email.service";

async function main() {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error(
      "Usage: npx ts-node scripts/test-brevo-invite-email.ts recipient@example.com"
    );
    process.exit(1);
  }

  console.log("[test] transport", getEmailTransportLogContext());
  console.log("[test] provider", getEmailProviderInfo());

  const result = await sendEmail({
    to,
    subject: "[Test] Invitation GestionPro",
    html: "<p>Test invitation email (scripts/test-brevo-invite-email.ts)</p>",
    text: "Test invitation email",
  });

  console.log("[test] result:", JSON.stringify(result, null, 2));
  process.exit(result.delivered ? 0 : 1);
}

void main().catch((err) => {
  console.error("[test] fatal", err);
  process.exit(1);
});
