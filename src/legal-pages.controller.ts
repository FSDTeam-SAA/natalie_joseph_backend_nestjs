import { Controller, Get, Header, SetMetadata } from '@nestjs/common';

const contact = 'fsdteam.saa@gmail.com';
const contactLink = `<a href="mailto:${contact}">${contact}</a>`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Meet Elysia</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f6fa; color: #202737; font: 17px/1.7 system-ui, sans-serif; }
    main { max-width: 820px; margin: 40px auto; padding: 40px; background: white; border: 1px solid #e1e5ed; border-radius: 16px; }
    nav { display: flex; flex-wrap: wrap; gap: 8px 24px; border-bottom: 1px solid #e1e5ed; padding-bottom: 20px; }
    a { color: #3945a4; overflow-wrap: anywhere; }
    a:focus-visible { outline: 3px solid #3945a4; outline-offset: 4px; }
    h1 { line-height: 1.2; font-size: 36px; } h2 { font-size: 22px; margin-top: 30px; }
    .brand { color: #555f73; font-weight: 700; letter-spacing: .04em; }
    footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e1e5ed; }
    @media (max-width: 600px) { main { margin: 12px; padding: 24px; } h1 { font-size: 30px; } }
  </style>
</head>
<body><main>
  <p class="brand">MEET ELYSIA</p>
  <nav aria-label="Policy pages"><a href="/privacy-policy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/data-deletion">Data Deletion</a></nav>
  <h1>${title}</h1><p>Last updated: September 14, 2026</p>
  ${body}
  <footer>Questions about Meet Elysia? Contact ${contactLink}.</footer>
</main></body></html>`;
}

@Controller()
@SetMetadata('rawResponse', true)
export class LegalPagesController {
  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacyPolicy(): string {
    return page(
      'Privacy Policy',
      `
      <p>This policy describes information processed by Meet Elysia through its website, accounts, AI companion features and WhatsApp integration.</p>
      <h2>Information we process</h2>
      <ul>
        <li>Account information such as your email, name, password hash, optional phone number and profile image.</li>
        <li>Messages you send, generated responses, conversation identifiers, selected companions and interaction history.</li>
        <li>For WhatsApp, your sender number, message identifiers, message content and account-linking information received through Meta.</li>
        <li>Subscription status, payment records, payment-provider identifiers, credits and purchases.</li>
        <li>Operational information used to investigate errors, secure accounts and process message delivery.</li>
      </ul>
      <h2>How information is used</h2>
      <p>We use this information to authenticate accounts, link WhatsApp conversations to users and companions, generate and deliver replies, manage subscriptions and credits, provide support and troubleshoot the service. Authorized administrators can access conversations for support and human takeover.</p>
      <h2>Service providers</h2>
      <p>Operating the service involves providers for hosting and database storage, AI processing, email, media storage and payments. Relevant message content and conversation context are sent to the configured AI service when AI replies are enabled. Meta processes WhatsApp messages; Stripe handles payment processing; uploaded profile media may be stored through Cloudinary. These providers process information under their own applicable terms and privacy policies.</p>
      <h2>Storage and retention</h2>
      <p>Account, conversation and transaction information is stored to operate the service. Retention varies by record type and provider; there is no single automatic deletion period for all records. Contact us to request deletion or ask about a particular record. Some records may need to be retained for applicable obligations, dispute resolution or security, and provider backups may follow separate retention schedules.</p>
      <h2>Your choices and requests</h2>
      <p>You may stop messaging the service and contact ${contactLink} to request access, correction or deletion of your information. Follow our <a href="/data-deletion">data deletion instructions</a> to identify the account or WhatsApp data involved. Deleting a chat in WhatsApp does not itself delete records held by Meet Elysia.</p>
      <h2>Security and updates</h2>
      <p>Account passwords are stored as hashes. No online system can guarantee absolute security; do not send passwords, payment card details or other unnecessary sensitive information in companion chats. Updates to this policy will be reflected on this page.</p>
    `,
    );
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms(): string {
    return page(
      'Terms of Service',
      `
      <p>These terms describe use of Meet Elysia's account, companion chat and WhatsApp features. By using the service, you agree to these terms.</p>
      <h2>Accounts and responsible use</h2>
      <p>Provide accurate account information, use only accounts and phone numbers you are authorized to use, and keep your credentials secure. Do not use the service for unlawful activity, harassment, fraud, unauthorized access or interference with other users or systems.</p>
      <h2>Companion conversations</h2>
      <p>Companions are AI-powered characters. Generated responses may be inaccurate or inappropriate and should not be relied on as professional advice or emergency assistance. Authorized administrators may participate through human takeover. Availability and response times can vary.</p>
      <h2>Subscriptions and credits</h2>
      <p>Some features require a subscription or credits. Review the price, renewal terms and purchase details shown at checkout before paying. Contact ${contactLink} for billing, cancellation or refund questions; applicable consumer rights remain unaffected.</p>
      <h2>Your content and privacy</h2>
      <p>Only submit content you have permission to share. You allow the service and its providers to process that content as needed to deliver the requested features. See our <a href="/privacy-policy">Privacy Policy</a> for data handling and our <a href="/data-deletion">Data Deletion</a> page for removal requests.</p>
      <h2>Third-party services and access</h2>
      <p>WhatsApp, payment services and other integrated providers have their own terms. Features may change or become unavailable. Access may be restricted to address abuse, security issues or violations of these terms.</p>
      <h2>Contact and changes</h2>
      <p>Questions or requests to close an account can be sent to ${contactLink}. Revised terms will be posted here with an updated date.</p>
    `,
    );
  }

  @Get('data-deletion')
  @Header('Content-Type', 'text/html; charset=utf-8')
  dataDeletion(): string {
    return page(
      'Data Deletion Instructions',
      `
      <p>You can request deletion of your Meet Elysia account or data associated with its WhatsApp integration by email.</p>
      <h2>Submit a request</h2>
      <ol>
        <li>Email ${contactLink} with the subject <strong>Meet Elysia Data Deletion Request</strong>.</li>
        <li>Send from your registered email where possible. Include the account email and, for WhatsApp data, your phone number with country code.</li>
        <li>Specify whether you want the entire account deleted or only particular data, such as WhatsApp linking information or conversation history.</li>
      </ol>
      <p>Do not include passwords, one-time codes, access tokens or payment card details.</p>
      <h2>What happens next</h2>
      <p>The support team handles requests manually and may ask for information needed to verify account ownership before processing deletion. Ask in the same email for confirmation of completion and the status of any retained records.</p>
      <h2>Scope and limitations</h2>
      <p>A request can cover your profile, stored conversations and WhatsApp account links. Records subject to applicable retention obligations or needed for disputes or security may require separate handling. Copies held in provider backups may follow their retention schedules.</p>
      <p>Deleting Meet Elysia data does not delete your Facebook or WhatsApp account or copies held by Meta or message recipients. Deleting a WhatsApp chat alone does not submit a deletion request to Meet Elysia. If you have an active subscription, include a cancellation request so support can address billing separately.</p>
      <p>Read our <a href="/privacy-policy">Privacy Policy</a> for an overview of the information processed by the service.</p>
    `,
    );
  }
}
