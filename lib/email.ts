import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  // HARDENED IN STEP 10: startup assertions
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is required. Obtain from your Resend dashboard (API Keys)."
    );
  }
  _resend = new Resend(key);
  return _resend;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  // HARDENED IN STEP 10: check API key first (startup assertion), then sender address
  const resend = getResend();

  const from = process.env.RESEND_FROM_ADDRESS;
  if (!from) {
    throw new Error(
      "RESEND_FROM_ADDRESS is required. Set to a verified Resend sender address, e.g. alerts@flyhome.ai."
    );
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: htmlBody,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
