/**
 * Public legal pages for the app stores:
 *   /privacy          → privacy policy (Google Play "Privacy policy URL")
 *   /delete-account   → how to delete your account and data (Google Play "Delete account URL")
 * Plain HTML, readable on phones, light and dark mode.
 */

const APP_NAME = "Split Daily";
const LAST_UPDATED = "2 October 2026";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · ${APP_NAME}</title>
<meta name="description" content="${escapeHtml(title)} for the ${APP_NAME} app.">
<style>
  :root { --bg:#F7F8F5; --card:#FFFFFF; --ink:#17231B; --muted:#56635A; --line:#E1E7DF; --accent:#20392A; --pill:#C8F169; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111713; --card:#18201A; --ink:#F0F6EE; --muted:#A9B6AB; --line:#2A382C; --accent:#D7FF76; --pill:#2B3A1E; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:32px 20px 64px; }
  header { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
  .logo { width:44px; height:44px; flex:none; }
  .brand { font-weight:800; font-size:18px; }
  h1 { font-size:32px; line-height:1.2; margin:0 0 6px; }
  .updated { color:var(--muted); margin:0 0 28px; }
  h2 { font-size:20px; margin:32px 0 8px; }
  p, li { color:var(--ink); }
  ul { padding-left:22px; }
  li { margin:4px 0; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:20px 22px; margin:16px 0; }
  .muted { color:var(--muted); }
  a { color:var(--accent); font-weight:600; }
  ol li { margin:8px 0; }
  .pill { display:inline-block; background:var(--pill); color:#14200F; border-radius:999px; padding:2px 10px; font-weight:700; font-size:14px; }
  @media (prefers-color-scheme: dark) { .pill { color:var(--ink); } }
  footer { margin-top:40px; color:var(--muted); font-size:14px; border-top:1px solid var(--line); padding-top:16px; }
</style>
</head>
<body>
<main>
<header>
  <svg class="logo" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#20392A"/><path d="M47 16.4 A30 30 0 0 0 47 76.4 Z" fill="#C8F169"/><path d="M53 23.6 A30 30 0 0 1 53 83.6 Z" fill="#F2A39D"/></svg>
  <span class="brand">${APP_NAME}</span>
</header>
${body}
<footer>${APP_NAME} · <a href="/privacy">Privacy policy</a> · <a href="/delete-account">Delete your account</a></footer>
</main>
</body>
</html>`;
}

function contactLine(email: string) {
  return email
    ? `email us at <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : "contact us through the support email listed on our Google Play page";
}

export function renderPrivacyPolicy(supportEmail: string) {
  const contact = contactLine(supportEmail);
  return layout(
    "Privacy Policy",
    `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: ${LAST_UPDATED}</p>

<p>${APP_NAME} helps friends, families and groups keep track of shared expenses and settle up. This policy explains what information the ${APP_NAME} mobile app and website (together, “the app”) collect, why, who can see it, and the choices you have. We keep it short and specific: we only collect what the app needs to work.</p>

<div class="card">
  <strong>In short</strong>
  <ul>
    <li>We get your <strong>name, email address and profile photo</strong> from Google when you sign in. We never see your Google password.</li>
    <li>We store the <strong>groups, expenses and payments</strong> you add, so you and the people you share them with can see them.</li>
    <li>We <strong>do not sell</strong> your data, show ads, or use advertising or analytics trackers.</li>
    <li>You can <strong>delete your account</strong> at any time from Settings in the app — <a href="/delete-account">see how</a>.</li>
  </ul>
</div>

<h2>1. Information we collect</h2>
<p><strong>From your Google account (when you sign in with Google):</strong></p>
<ul>
  <li>Your name, email address and profile photo.</li>
  <li>Google’s unique ID for your account, so we can recognise you next time.</li>
</ul>
<p><strong>Information you add in the app:</strong></p>
<ul>
  <li>Groups you create or join (name, description, type and currency) and who is in them.</li>
  <li>Expenses: description, amount, currency, date, category, optional notes, who paid and how it was split.</li>
  <li>Payments (“settle up”): who paid whom, amount, currency, payment method label (for example “Cash” or “JazzCash”) and optional notes. The app only records that a payment happened — it does <em>not</em> process payments or collect bank or card details.</li>
  <li>Email addresses you enter to invite someone to a group. They are used only to add that person to the group when they sign in.</li>
  <li>Your settings: display name, default currency and notification preferences.</li>
</ul>
<p><strong>Information collected automatically:</strong></p>
<ul>
  <li>For each sign-in session: the device/browser description sent by your device (user agent), the IP address, and when the session was created and last used. We use this to keep your account secure and to sign you out of old sessions.</li>
  <li>Your theme choice (light/dark) is stored only on your device.</li>
</ul>
<p>We do <strong>not</strong> collect your contacts, location, photos or files from your device, and we do not use advertising IDs.</p>

<h2>2. How we use your information</h2>
<ul>
  <li>To create and secure your account and keep you signed in.</li>
  <li>To show your groups, expenses, balances and payments, and to calculate who owes whom.</li>
  <li>To let you add people to groups by email or invite code.</li>
  <li>To show in-app notifications (for example, when someone adds or edits an expense with you), according to your notification settings.</li>
  <li>To keep the service working, prevent abuse and fix problems.</li>
</ul>
<p>We do not use your information for advertising, and we do not make automated decisions about you.</p>

<h2>3. Who can see your information</h2>
<ul>
  <li><strong>People in your groups</strong> can see your name, profile photo and email address, the expenses and payments you are part of, and your balance in that group. Only share groups with people you trust.</li>
  <li><strong>Service providers</strong> that run the app for us, only as needed to provide it: our web hosting provider (which runs the app’s server) and Neon (our database provider, which stores data in the United States). Google provides sign-in.</li>
  <li><strong>Legal reasons:</strong> we may disclose information if required by law or to protect the rights and safety of our users.</li>
</ul>
<p>We do not sell or rent your personal information to anyone.</p>

<h2>4. Security</h2>
<p>All data is sent over encrypted connections (HTTPS/TLS), including between our server and the database. Sign-in uses Google; we never receive or store passwords. Access to the server and database is restricted. No method of storage or transmission is 100% secure, but we work to protect your information.</p>

<h2>5. How long we keep information</h2>
<ul>
  <li>Your account information is kept while your account exists.</li>
  <li>Sign-in sessions expire after 30 days, or when you sign out.</li>
  <li>Group invitations sent by email expire after 60 days if not used.</li>
  <li>When you delete your account, your name, email address and profile photo are erased, your Google sign-in link is removed and all your sessions are ended — see below.</li>
</ul>

<h2>6. Deleting your account</h2>
<p>You can delete your account at any time in the app: <strong>Profile → Settings → Delete account</strong>. Instructions and other options are on our <a href="/delete-account">account deletion page</a>.</p>
<p>Because ${APP_NAME} is a shared ledger, expenses and payments you were part of stay in your friends’ groups so their balances remain correct, but they are shown as “Deleted user” and are no longer linked to your name, email or photo.</p>

<h2>7. Your choices and rights</h2>
<ul>
  <li><strong>Access and correction:</strong> you can see your information in the app and change your display name in Settings.</li>
  <li><strong>Notifications:</strong> turn in-app notifications on or off in Settings.</li>
  <li><strong>Deletion:</strong> delete your account in the app, or ask us to.</li>
  <li><strong>Copy of your data:</strong> you can ask us for a copy of the personal information we hold about you.</li>
</ul>
<p>To make a request, ${contact}. We will respond within 30 days.</p>

<h2>8. Children</h2>
<p>${APP_NAME} is not intended for children under 13, and we do not knowingly collect personal information from them. If you believe a child has created an account, ${contact} and we will delete it.</p>

<h2>9. Changes to this policy</h2>
<p>If we change this policy, we will update the “Last updated” date above and, for significant changes, let you know in the app.</p>

<h2>10. Contact</h2>
<p>Questions about this policy or your data? ${contact[0]!.toUpperCase()}${contact.slice(1)}.</p>
`,
  );
}

export function renderDeleteAccountPage(supportEmail: string) {
  const contact = contactLine(supportEmail);
  const mailto = supportEmail
    ? `<a href="mailto:${escapeHtml(supportEmail)}?subject=${encodeURIComponent(`Delete my ${APP_NAME} account`)}&body=${encodeURIComponent("Please delete my Split Daily account. The Google email I sign in with is: ")}">send us a deletion request by email</a>`
    : "contact us through the support email listed on our Google Play page";
  return layout(
    "Delete your account",
    `
<h1>Delete your ${APP_NAME} account</h1>
<p class="updated">How to delete your account and what happens to your data</p>

<div class="card">
  <strong>Delete it yourself in the app <span class="pill">Fastest</span></strong>
  <ol>
    <li>Open ${APP_NAME} and sign in.</li>
    <li>Tap the <strong>Profile</strong> tab, then <strong>Settings</strong>.</li>
    <li>Scroll to the bottom and tap <strong>Delete account</strong>, then confirm.</li>
  </ol>
  <p class="muted">Tip: settle up with your friends first, so everyone’s balances are clear.</p>
</div>

<div class="card">
  <strong>Can’t open the app?</strong>
  <p>You can ${mailto} from the email address you use to sign in. We will delete the account within 30 days and confirm by email.</p>
</div>

<h2>What gets deleted</h2>
<ul>
  <li>Your name, email address and profile photo.</li>
  <li>The link to your Google account, so you can no longer sign in to this account.</li>
  <li>All your sign-in sessions (you are signed out everywhere).</li>
  <li>Your notification settings and your membership in all groups.</li>
</ul>

<h2>What is kept, and why</h2>
<p>Expenses and payments you shared with other people stay in their groups so their balances remain correct. They are shown as made by “Deleted user” and are no longer connected to your name, email or photo. If you would like those records removed as well, ${contact} — note that this can change what other people see they owe.</p>

<p>If you sign in with Google again after deleting your account, a new, empty account is created.</p>

<p>More details are in our <a href="/privacy">Privacy Policy</a>.</p>
`,
  );
}
