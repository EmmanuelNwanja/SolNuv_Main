import type { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getPublicLayout } from '../components/Layout';

const EFFECTIVE_DATE = 'April 5, 2025';
const LAST_UPDATED  = 'April 5, 2026';

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-forest-900 dark:text-white mt-10 mb-3 scroll-mt-24">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-2">{children}</h3>;
}

const TOC = [
  { id: 'who-we-are',        label: '1. Who We Are' },
  { id: 'scope',             label: '2. Scope of This Policy' },
  { id: 'data-we-collect',   label: '3. Data We Collect' },
  { id: 'pwa-data',          label: '3.9 PWA & Mobile App Data' },
  { id: 'how-we-use',        label: '4. How We Use Your Data' },
  { id: 'legal-basis',       label: '5. Legal Basis for Processing' },
  { id: 'sharing',           label: '6. Data Sharing & Third Parties' },
  { id: 'international',     label: '7. International Transfers' },
  { id: 'retention',         label: '8. Data Retention' },
  { id: 'security',          label: '9. Security Measures' },
  { id: 'your-rights',       label: '10. Your Rights' },
  { id: 'cookies',           label: '11. Cookies, Storage & PWA' },
  { id: 'children',          label: '12. Children\'s Privacy' },
  { id: 'changes',           label: '13. Changes to This Policy' },
  { id: 'contact',           label: '14. Contact & Data Protection Officer' },
];

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — SolNuv | Africa&apos;s Solar Engineering Platform</title>
        <meta name="description" content="How SolNuv collects, uses, stores, and protects your personal data. Compliant with the Nigeria Data Protection Act 2023 (NDPA), NDPR, and international best practice." />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white px-8 py-12 mb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.10),transparent_60%)]" />
        <div className="relative max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Legal</span>
          <h1 className="font-display font-bold text-3xl md:text-4xl">Privacy Policy</h1>
          <p className="text-white/70 text-sm mt-3 max-w-xl">
            Your privacy matters. This policy explains what data we collect, why, how we protect it, and the rights you have under Nigerian and applicable international law.
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/60">
            <span>Effective: {EFFECTIVE_DATE}</span>
            <span>·</span>
            <span>Last updated: {LAST_UPDATED}</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-10">
        {/* Sidebar TOC (desktop) */}
        <nav className="hidden lg:block lg:w-56 flex-shrink-0 sticky top-24 self-start">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Contents</p>
          <ul className="space-y-1.5 text-sm">
            {TOC.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`} className="block text-slate-500 dark:text-slate-400 hover:text-forest-700 dark:hover:text-emerald-400 transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Body */}
        <article className="prose prose-slate dark:prose-invert prose-sm max-w-none flex-1 text-slate-600 dark:text-slate-300">
          <p className="lead text-base text-slate-700 dark:text-slate-200">
            This Privacy Policy (&quot;Policy&quot;) describes how <strong>Fudo Greentech Limited</strong> (trading as <strong>SolNuv</strong>), together with its parent, subsidiary, and affiliated entities including <strong>Afrocarb</strong> (collectively, &quot;SolNuv&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), collects, uses, stores, discloses, and protects your personal data when you access or use the SolNuv platform, website, mobile applications, APIs, and related services (collectively, the &quot;Platform&quot;).
          </p>
          <p>
            We are committed to protecting your privacy in compliance with the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong>, the <strong>Nigeria Data Protection Regulation (NDPR)</strong>, and other applicable domestic and international data protection laws, including the EU General Data Protection Regulation (GDPR) where applicable to users located in the European Economic Area.
          </p>

          {/* ──────────────────────────────── 1 ──────────────────────────────── */}
          <SectionHeading id="who-we-are">1. Who We Are</SectionHeading>
          <p>
            SolNuv is Nigeria&apos;s solar lifecycle intelligence platform, operated by Fudo Greentech Limited, a company incorporated and registered in the Federal Republic of Nigeria. References to &quot;we&quot;, &quot;us&quot;, and &quot;our&quot; include our parent company, subsidiaries, affiliates (including Afrocarb), and any future successor entities.
          </p>
          <p>
            <strong>Data Controller:</strong> Fudo Greentech Limited, Lagos, Nigeria.
          </p>
          <p>
            For data protection enquiries, contact our Data Protection Officer at <a href="mailto:privacy@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">privacy@solnuv.com</a> or <a href="mailto:compliance@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">compliance@solnuv.com</a>.
          </p>

          {/* ──────────────────────────────── 2 ──────────────────────────────── */}
          <SectionHeading id="scope">2. Scope of This Policy</SectionHeading>
          <p>
            This Policy applies to all individuals (&quot;you&quot; or &quot;users&quot;) who:
          </p>
          <ul>
            <li>Access our website at <strong>solnuv.com</strong> or any sub-domains;</li>
            <li>Create an account or use any part of the SolNuv platform;</li>
            <li>Use our calculators, engineering tools, or APIs;</li>
            <li>Subscribe to any paid plan (Basic, Pro, Elite, Enterprise);</li>
            <li>Submit a contact form, receive our emails, or communicate with our support team;</li>
            <li>Interact with us as a partner, vendor, or regulatory body.</li>
          </ul>
          <p>
            This Policy does not cover third-party websites or services linked from our Platform. We encourage you to review their privacy policies independently.
          </p>

          {/* ──────────────────────────────── 3 ──────────────────────────────── */}
          <SectionHeading id="data-we-collect">3. Data We Collect</SectionHeading>

          <SubHeading>3.1 Account & Identity Data</SubHeading>
          <p>When you register for an account, we collect:</p>
          <ul>
            <li>Email address</li>
            <li>Phone number (verified via SMS one-time password)</li>
            <li>Password (stored in hashed form only — we do not store plain-text passwords)</li>
            <li>First name, last name</li>
            <li>User type (installer, EPC, developer)</li>
            <li>Business type (solo engineer or registered company)</li>
          </ul>

          <SubHeading>3.2 Business & Organisational Data</SubHeading>
          <p>If you operate as a registered company, you may provide:</p>
          <ul>
            <li>Company name, address, city, and state</li>
            <li>NESREA registration number</li>
            <li>Company email, website, logo, and branding assets</li>
            <li>Team member names and emails (when inviting colleagues)</li>
          </ul>

          <SubHeading>3.3 Project & Equipment Data</SubHeading>
          <p>To deliver core platform functionality, we process:</p>
          <ul>
            <li>Solar installation details (location, size, panel technology, battery chemistry, installation dates)</li>
            <li>Equipment records (brand, model, wattage, condition assessments)</li>
            <li>Calculated outputs (State of Health, decommission dates, silver recovery estimates, cable sizing results)</li>
            <li>NESREA compliance reports and audit records</li>
          </ul>

          <SubHeading>3.4 Financial & Payment Data</SubHeading>
          <p>
            Subscription payments are processed by our PCI-DSS-compliant payment partner, <strong>Paystack</strong> (a Stripe company). We <strong>never</strong> receive, store, or process your full card number, CVV, or bank PIN. We store only:
          </p>
          <ul>
            <li>Paystack customer ID and subscription reference</li>
            <li>Plan type, billing interval, and payment status</li>
            <li>Transaction history (amounts, dates, success/failure status)</li>
          </ul>

          <SubHeading>3.5 Communication Data</SubHeading>
          <ul>
            <li>Contact form submissions (name, email, phone, subject, message)</li>
            <li>Support correspondence</li>
            <li>Email delivery metadata (opens, bounces) processed by our email provider</li>
          </ul>

          <SubHeading>3.6 Usage & Analytics Data</SubHeading>
          <p>We automatically collect:</p>
          <ul>
            <li>Pages visited, session identifiers, and timestamps</li>
            <li>Calculator usage frequency (by calculator type)</li>
            <li>Blog engagement metrics (reads, time spent, link clicks)</li>
            <li>Public profile and leaderboard visibility settings configured by authorised account users</li>
            <li>Sponsored placement interaction metrics in eligible public content surfaces</li>
            <li>Device type, browser type, and screen resolution</li>
            <li>IP address (anonymised within 30 days for analytics)</li>
            <li>PWA install status and app launch events (for service improvement)</li>
            <li>Offline activity queued for sync when connection is restored</li>
            <li>Service worker cache sizes (for storage management)</li>
          </ul>

          <SubHeading>3.7 Data from Third-Party Authentication</SubHeading>
          <p>
            If you sign in using Google OAuth, we receive your email address and profile photo URL from Google. We do not receive your Google password, contacts, or any other Google account data.
          </p>

          <SubHeading>3.8 AI Interaction Data</SubHeading>
          <p>
            When you use SolNuv&apos;s AI-powered agents (available on all subscription tiers), we collect:
          </p>
          <ul>
            <li>Conversation messages you send to AI agents and the responses generated;</li>
            <li>Agent type, session identifiers, and timestamps;</li>
            <li>Project and company context provided to the AI to personalise responses;</li>
            <li>Task descriptions, results, and status for asynchronous AI tasks (Elite and Enterprise plans).</li>
          </ul>
          <p>
            AI conversations are processed in real time by our LLM providers (currently Google Gemini and Groq). These providers act as data processors and do not retain your data for their own training purposes under our agreements with them.
          </p>

          {/* ──────────────────────────────── 3.9 ──────────────────────────────── */}
          <SectionHeading id="pwa-data">3.9 PWA & Mobile App Data</SectionHeading>
          <p>
            When you install the SolNuv platform as a Progressive Web App (PWA), the following data may be stored locally on your device:
          </p>

          <SubHeading>3.9.1 Cached Data</SubHeading>
          <p>
            To enable offline functionality and faster loading, we cache the following locally:
          </p>
          <ul>
            <li>Static assets (scripts, stylesheets, icons, fonts)</li>
            <li>The app manifest and configuration files</li>
            <li>An offline fallback page for network unavailability</li>
          </ul>
          <p>
            Cached data is used only to improve app performance and availability. Authentication state, project data, and API responses are never cached offline.
          </p>

          <SubHeading>3.9.2 Local Storage</SubHeading>
          <p>
            Your device may store locally:
          </p>
          <ul>
            <li>Theme preference (light/dark mode)</li>
            <li>Onboarding progress for incomplete registration flows</li>
            <li>Offline queue for data that syncs when connection is restored</li>
            <li>PWA install prompt dismissal state (to avoid repeated prompts)</li>
          </ul>
          <p>
            You can clear this data at any time through your browser or device settings. Disabling local storage may affect offline functionality.
          </p>

          <SubHeading>3.9.3 PWA Install Data</SubHeading>
          <p>
            PWA installation creates a standalone app entry on your device. This is managed by your browser and operating system, not by SolNuv servers. Uninstalling the PWA does not delete your account or data — your data remains on our servers and accessible via the website.
          </p>

          {/* ──────────────────────────────── 4 ──────────────────────────────── */}
          <SectionHeading id="how-we-use">4. How We Use Your Data</SectionHeading>
          <p>We process your personal data for the following purposes:</p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-200">Purpose</th>
                <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-200">Data Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className="py-2 pr-4">Account creation & authentication</td><td>Email, phone, password hash, name</td></tr>
              <tr><td className="py-2 pr-4">Phone verification (SMS OTP)</td><td>Phone number</td></tr>
              <tr><td className="py-2 pr-4">Delivering platform services (calculators, reports, project tracking)</td><td>Project data, equipment records, location</td></tr>
              <tr><td className="py-2 pr-4">Processing payments & managing subscriptions</td><td>Email, Paystack IDs, plan details</td></tr>
              <tr><td className="py-2 pr-4">NESREA EPR compliance report generation</td><td>Equipment, project, company data</td></tr>
              <tr><td className="py-2 pr-4">Customer support & responding to enquiries</td><td>Contact form data, correspondence</td></tr>
              <tr><td className="py-2 pr-4">Platform improvement & analytics</td><td>Usage data, session data (anonymised)</td></tr>
              <tr><td className="py-2 pr-4">Public directory and leaderboard controls</td><td>Visibility settings, public-facing profile fields, project summary indicators</td></tr>
              <tr><td className="py-2 pr-4">Sponsored placement measurement (where used)</td><td>Placement impressions, clicks, and related engagement events</td></tr>
              <tr><td className="py-2 pr-4">Sending transactional emails (welcome, decommission alerts, team invitations)</td><td>Email, name, project details</td></tr>
              <tr><td className="py-2 pr-4">Fraud prevention & platform security</td><td>IP address, usage patterns, rate-limiting data</td></tr>
              <tr><td className="py-2 pr-4">AI agent services (conversational guidance, project analysis, compliance reviews)</td><td>Conversation messages, project context, company data</td></tr>
              <tr><td className="py-2 pr-4">Legal compliance & regulatory obligations</td><td>As required by applicable law</td></tr>
            </tbody>
          </table>

          <p className="mt-4">
            We do <strong>not</strong> sell, rent, or trade your personal data to third parties for marketing purposes. We do <strong>not</strong> use your data for automated decision-making or profiling that produces legal effects.
          </p>

          {/* ──────────────────────────────── 5 ──────────────────────────────── */}
          <SectionHeading id="legal-basis">5. Legal Basis for Processing</SectionHeading>
          <p>Under the NDPA 2023 and, where applicable, the GDPR, we rely on the following lawful bases:</p>
          <ul>
            <li><strong>Consent:</strong> When you create an account, submit a contact form, or opt in to communications. You may withdraw consent at any time.</li>
            <li><strong>Contractual necessity:</strong> Processing required to perform our agreement with you (e.g., delivering platform services, processing payments, managing your subscription).</li>
            <li><strong>Legitimate interest:</strong> Platform security, fraud prevention, analytics for service improvement, and enforcing our Terms of Service — balanced against your rights and expectations.</li>
            <li><strong>Legal obligation:</strong> Where Nigerian law or regulatory requirements compel us to process or retain data (e.g., NESREA reporting mandates, financial record-keeping, tax compliance).</li>
          </ul>

          {/* ──────────────────────────────── 6 ──────────────────────────────── */}
          <SectionHeading id="sharing">6. Data Sharing & Third Parties</SectionHeading>
          <p>
            We share your personal data only when necessary and only with the following categories of recipients:
          </p>

          <SubHeading>6.1 Service Providers (Data Processors)</SubHeading>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-200">Provider</th>
                <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-200">Purpose</th>
                <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-200">Data Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className="py-2 pr-4">Supabase</td><td className="pr-4">Cloud database & authentication</td><td>Account data, project data</td></tr>
              <tr><td className="py-2 pr-4">Paystack (Stripe)</td><td className="pr-4">Payment processing</td><td>Email, payment amounts</td></tr>
              <tr><td className="py-2 pr-4">Brevo (Sendinblue)</td><td className="pr-4">Transactional email delivery</td><td>Email, name, company name</td></tr>
              <tr><td className="py-2 pr-4">Termii</td><td className="pr-4">SMS OTP verification</td><td>Phone number</td></tr>
              <tr><td className="py-2 pr-4">Google OAuth</td><td className="pr-4">Social sign-in (optional)</td><td>Email, avatar URL</td></tr>
              <tr><td className="py-2 pr-4">Google Gemini</td><td className="pr-4">AI language model processing</td><td>Conversation messages, project context</td></tr>
              <tr><td className="py-2 pr-4">Groq</td><td className="pr-4">AI language model processing (fallback)</td><td>Conversation messages, project context</td></tr>
            </tbody>
          </table>
          <p className="mt-3">
            Each service provider operates under a data processing agreement and is contractually bound to process your data only on our instructions and in compliance with applicable data protection laws.
          </p>

          <SubHeading>6.2 Corporate Group</SubHeading>
          <p>
            We may share data within our corporate group — including our parent company, Afrocarb, subsidiaries, and affiliated entities — for internal administration, consolidated analytics, shared service delivery, and compliance purposes. All group entities are bound by this Policy.
          </p>

          <SubHeading>6.3 Legal & Regulatory Disclosures</SubHeading>
          <p>We may disclose personal data when required to:</p>
          <ul>
            <li>Comply with applicable law, regulation, or legal process;</li>
            <li>Respond to lawful requests from Nigerian government authorities, including NESREA, NITDA, and law enforcement;</li>
            <li>Protect our rights, property, or safety — or that of our users or the public;</li>
            <li>Enforce our Terms of Service or investigate potential violations;</li>
            <li>Support any merger, acquisition, or reorganisation of our business (see Section 6.4).</li>
          </ul>

          <SubHeading>6.4 Business Transfers</SubHeading>
          <p>
            In the event of a merger, acquisition, reorganisation, asset sale, or transfer of all or part of our business, your personal data may be among the assets transferred. We will notify you via email and/or prominent notice on the Platform before your data becomes subject to a different privacy policy.
          </p>

          {/* ──────────────────────────────── 7 ──────────────────────────────── */}
          <SectionHeading id="international">7. International Data Transfers</SectionHeading>
          <p>
            Our primary infrastructure is hosted outside Nigeria (cloud providers operate data centres in Europe and the United States). Where your personal data is transferred outside Nigeria, we ensure appropriate safeguards are in place:
          </p>
          <ul>
            <li>Standard contractual clauses or equivalent transfer mechanisms approved by NITDA;</li>
            <li>The receiving country provides an adequate level of data protection; or</li>
            <li>The transfer is necessary for the performance of our contract with you.</li>
          </ul>
          <p>
            You may request information about the specific safeguards applied to your data by contacting our Data Protection Officer.
          </p>

          {/* ──────────────────────────────── 8 ──────────────────────────────── */}
          <SectionHeading id="retention">8. Data Retention</SectionHeading>
          <p>We retain your personal data only for as long as necessary to fulfil the purposes described in this Policy, unless a longer retention period is required or permitted by law.</p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-200">Data Category</th>
                <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-200">Retention Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className="py-2 pr-4">Account data</td><td>Duration of account + 12 months after deletion request</td></tr>
              <tr><td className="py-2 pr-4">Project & equipment records</td><td>Duration of account + 6 years (regulatory compliance)</td></tr>
              <tr><td className="py-2 pr-4">Payment transaction records</td><td>7 years (Nigerian tax & financial regulations)</td></tr>
              <tr><td className="py-2 pr-4">NESREA compliance reports</td><td>10 years (environmental regulatory mandate)</td></tr>
              <tr><td className="py-2 pr-4">Contact form submissions</td><td>24 months</td></tr>
              <tr><td className="py-2 pr-4">Analytics & usage data</td><td>24 months (anonymised after 30 days)</td></tr>
              <tr><td className="py-2 pr-4">Audit logs</td><td>5 years</td></tr>
              <tr><td className="py-2 pr-4">AI conversation logs & task records</td><td>Duration of account + 12 months (or until deletion request)</td></tr>
              <tr><td className="py-2 pr-4">Visibility and sponsored-content interaction logs</td><td>24 months (or longer where required for fraud/security review)</td></tr>
            </tbody>
          </table>

          <p className="mt-3">
            When data is no longer needed, it is securely deleted or irreversibly anonymised. Backup copies are purged on a rolling schedule not exceeding 90 days.
          </p>

          {/* ──────────────────────────────── 9 ──────────────────────────────── */}
          <SectionHeading id="security">9. Security Measures</SectionHeading>
          <p>We implement appropriate technical and organisational measures to protect your data, including:</p>
          <ul>
            <li><strong>Encryption in transit:</strong> All data transmitted between you and our servers uses TLS 1.2 or higher.</li>
            <li><strong>Encryption at rest:</strong> Sensitive data is encrypted using AES-256 or equivalent at the database level.</li>
            <li><strong>Password security:</strong> Passwords are salted and hashed using industry-standard algorithms. We never store or can access your plain-text password.</li>
            <li><strong>Access controls:</strong> Internal access to personal data is restricted to authorised personnel on a need-to-know basis, with role-based access controls and audit logging.</li>
            <li><strong>Payment isolation:</strong> PCI-DSS-compliant payment processing through Paystack — card data never touches our servers.</li>
            <li><strong>Rate limiting:</strong> API and form submission rate limits to prevent abuse and brute-force attacks.</li>
            <li><strong>Regular review:</strong> We periodically review and update our security practices in line with evolving threats.</li>
          </ul>
          <p>
            While we strive to protect your data, no method of electronic transmission or storage is 100% secure. If you become aware of a security vulnerability, please report it responsibly to <a href="mailto:security@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">security@solnuv.com</a>.
          </p>

          {/* ──────────────────────────────── 10 ──────────────────────────────── */}
          <SectionHeading id="your-rights">10. Your Rights</SectionHeading>
          <p>
            Under the NDPA 2023, NDPR, and (where applicable) the GDPR, you have the following rights regarding your personal data:
          </p>
          <ul>
            <li><strong>Right of access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Right to rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to erasure (&quot;right to be forgotten&quot;):</strong> Request deletion of your data, subject to our legal retention obligations.</li>
            <li><strong>Right to restrict processing:</strong> Request that we limit how we use your data in certain circumstances.</li>
            <li><strong>Right to data portability:</strong> Receive your data in a structured, commonly used, machine-readable format.</li>
            <li><strong>Right to object:</strong> Object to processing based on legitimate interests.</li>
            <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, withdraw at any time without affecting lawfulness of prior processing.</li>
            <li><strong>Right to lodge a complaint:</strong> File a complaint with the Nigeria Data Protection Commission (NDPC) or the relevant supervisory authority in your jurisdiction.</li>
          </ul>
          <p>
            To exercise any of these rights, email <a href="mailto:privacy@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">privacy@solnuv.com</a> with the subject line &quot;Data Rights Request&quot;. We will respond within 30 days.
          </p>
          <p>
            You may also manage certain data directly through your account Settings page, including updating your profile, adjusting notification preferences, and downloading your project data.
          </p>

          {/* ──────────────────────────────── 11 ──────────────────────────────── */}
          <SectionHeading id="cookies">11. Cookies, Storage & PWA Mechanisms</SectionHeading>

          <SubHeading>11.1 What We Use</SubHeading>
          <p>We use the following client-side storage mechanisms:</p>
          <ul>
            <li><strong>Session storage:</strong> A randomly generated session identifier for analytics (not linked to your identity and cleared when you close the browser).</li>
            <li><strong>Local storage:</strong> Offline queue data (e.g., cable compliance records awaiting sync), theme preference, and authentication tokens.</li>
            <li><strong>Service worker cache:</strong> Static assets cached for offline capability. Authenticated pages and API responses are never cached.</li>
          </ul>

          <SubHeading>11.2 Service Worker Cache</SubHeading>
          <p>
            A service worker caches the following for offline capability and improved performance:
          </p>
          <ul>
            <li>App shell (HTML, CSS, JavaScript for core UI)</li>
            <li>Static images and fonts</li>
            <li>An offline fallback page</li>
            <li>The PWA manifest file</li>
          </ul>
          <p>
            Authentication tokens, API responses, and user data are explicitly excluded from caching to protect your privacy. The service worker cannot access your account credentials or personal data stored on our servers.
          </p>

          <SubHeading>11.3 What We Do Not Use</SubHeading>
          <p>
            We do <strong>not</strong> use third-party advertising cookies, tracking pixels from ad networks, or cross-site behavioural profiling tools. We do not sell or share your browsing data with advertisers.
          </p>

          <SubHeading>11.4 Managing Preferences</SubHeading>
          <p>
            You can clear local storage and session storage at any time through your browser settings. Disabling local storage may affect offline functionality.
          </p>

          {/* ──────────────────────────────── 12 ──────────────────────────────── */}
          <SectionHeading id="children">12. Children&apos;s Privacy</SectionHeading>
          <p>
            SolNuv is a professional platform for solar energy engineers, businesses, and regulatory professionals. We do not knowingly collect personal data from anyone under the age of 18. If we discover that a child under 18 has provided personal data, we will delete it promptly. If you believe a minor has registered, please contact us at <a href="mailto:privacy@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">privacy@solnuv.com</a>.
          </p>

          {/* ──────────────────────────────── 13 ──────────────────────────────── */}
          <SectionHeading id="changes">13. Changes to This Policy</SectionHeading>
          <p>
            We may update this Policy from time to time to reflect changes in our practices, services, or applicable law. When we make material changes:
          </p>
          <ul>
            <li>We will update the &quot;Last updated&quot; date at the top of this page;</li>
            <li>For changes that materially affect how we process your data, we will provide notice via email or a prominent banner on the Platform at least 14 days before the change takes effect;</li>
            <li>Your continued use of the Platform after the effective date of any updated Policy constitutes acceptance of the revised terms.</li>
          </ul>

          {/* ──────────────────────────────── 14 ──────────────────────────────── */}
          <SectionHeading id="contact">14. Contact & Data Protection Officer</SectionHeading>
          <p>If you have questions about this Policy or wish to exercise your data rights, contact us:</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 mt-3 space-y-2">
            <p><strong>Fudo Greentech Limited</strong> (trading as SolNuv)</p>
            <p>Lagos, Nigeria</p>
            <p>Email: <a href="mailto:privacy@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">privacy@solnuv.com</a></p>
            <p>General support: <a href="mailto:support@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">support@solnuv.com</a></p>
            <p>Compliance: <a href="mailto:compliance@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">compliance@solnuv.com</a></p>
            <p>Phone / WhatsApp: <a href="tel:+2348135244971" className="text-forest-600 dark:text-emerald-400 underline">+234 813 5244 971</a></p>
          </div>
          <p className="mt-4">
            If you are not satisfied with our response, you have the right to lodge a complaint with the <strong>Nigeria Data Protection Commission (NDPC)</strong> or the appropriate data protection authority in your jurisdiction.
          </p>

          {/* Closing */}
          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Fudo Greentech Limited (SolNuv). All rights reserved. Powered by Fudo Greentech · Afrocarb.
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <Link href="/terms" className="text-forest-600 dark:text-emerald-400 underline hover:text-forest-800 dark:hover:text-emerald-300">Terms of Service</Link>
              <Link href="/contact" className="text-forest-600 dark:text-emerald-400 underline hover:text-forest-800 dark:hover:text-emerald-300">Contact Us</Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}

PrivacyPolicy.getLayout = getPublicLayout;
