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
  { id: 'acceptance',           label: '1. Acceptance of Terms' },
  { id: 'definitions',          label: '2. Definitions' },
  { id: 'eligibility',          label: '3. Eligibility' },
  { id: 'account',              label: '4. Account Registration & Security' },
  { id: 'platform-services',    label: '5. Platform Services' },
  { id: 'subscriptions',        label: '6. Subscriptions & Payment' },
  { id: 'acceptable-use',       label: '7. Acceptable Use Policy' },
  { id: 'intellectual-property', label: '8. Intellectual Property' },
  { id: 'user-content',         label: '9. User Content & Data' },
  { id: 'calculators',          label: '10. Calculator & Engineering Tools' },
  { id: 'compliance-reports',   label: '11. NESREA Compliance Reports' },
  { id: 'ai-services',           label: '12. AI-Powered Services' },
  { id: 'third-party',          label: '13. Third-Party Services' },
  { id: 'disclaimers',          label: '14. Disclaimers & No Warranties' },
  { id: 'limitation',           label: '15. Limitation of Liability' },
  { id: 'indemnification',      label: '16. Indemnification' },
  { id: 'termination',          label: '17. Termination' },
  { id: 'dispute',              label: '18. Dispute Resolution & Governing Law' },
  { id: 'force-majeure',        label: '19. Force Majeure' },
  { id: 'general',              label: '20. General Provisions' },
  { id: 'changes',              label: '21. Changes to These Terms' },
  { id: 'contact',              label: '22. Contact Information' },
];

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service — SolNuv | Africa&apos;s Solar Engineering Platform</title>
        <meta name="description" content="Terms and conditions governing your use of the SolNuv solar engineering, design, modelling, and compliance platform. Please read carefully before creating an account." />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white px-8 py-12 mb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.10),transparent_60%)]" />
        <div className="relative max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Legal</span>
          <h1 className="font-display font-bold text-3xl md:text-4xl">Terms of Service</h1>
          <p className="text-white/70 text-sm mt-3 max-w-xl">
            These terms form a legally binding agreement between you and SolNuv. By using the platform, you agree to these terms in full.
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
            These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;you&quot;, &quot;your&quot;, or &quot;User&quot;) and <strong>Fudo Greentech Limited</strong> (trading as <strong>SolNuv</strong>), together with its parent, subsidiary, and affiliated entities including <strong>Afrocarb</strong> (collectively, &quot;SolNuv&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), governing your access to and use of the SolNuv platform, website, mobile applications, APIs, and all related services (collectively, the &quot;Platform&quot;).
          </p>
          <p>
            <strong>Please read these Terms carefully.</strong> By creating an account, accessing the Platform, or using any of our services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline">Privacy Policy</Link>, which is incorporated herein by reference.
          </p>

          {/* ──────────────────────────────── 1 ──────────────────────────────── */}
          <SectionHeading id="acceptance">1. Acceptance of Terms</SectionHeading>
          <p>
            By accessing or using the Platform in any manner — including browsing, registering, running calculations, creating projects, or making a purchase — you agree to be bound by these Terms. If you do not agree to all of the Terms, you must not access or use the Platform.
          </p>
          <p>
            If you are using the Platform on behalf of a company, organisation, or other legal entity, you represent and warrant that you have the authority to bind that entity to these Terms, in which case &quot;you&quot; and &quot;your&quot; refer to that entity.
          </p>

          {/* ──────────────────────────────── 2 ──────────────────────────────── */}
          <SectionHeading id="definitions">2. Definitions</SectionHeading>
          <ul>
            <li><strong>&quot;Platform&quot;</strong> means the SolNuv website (solnuv.com), web application, mobile applications (if any), APIs, calculators, engineering tools, and all related services.</li>
            <li><strong>&quot;Services&quot;</strong> means all features, functionality, tools, data, reports, and content provided through the Platform.</li>
            <li><strong>&quot;User Content&quot;</strong> means any data, information, text, materials, or other content that you submit, upload, or transmit through the Platform, including project data, equipment records, and profile information.</li>
            <li><strong>&quot;Subscription&quot;</strong> means a paid service plan (Basic, Pro, Elite, or Enterprise) that grants access to specific features and usage quotas.</li>
            <li><strong>&quot;SolNuv Group&quot;</strong> means Fudo Greentech Limited, its parent company, all subsidiaries, affiliates (including Afrocarb), officers, directors, employees, agents, and any successor entities.</li>
            <li><strong>&quot;Intellectual Property&quot;</strong> means all patents, trademarks, service marks, trade names, copyrights, trade secrets, algorithms, databases, source code, design elements, and any other proprietary rights.</li>
          </ul>

          {/* ──────────────────────────────── 3 ──────────────────────────────── */}
          <SectionHeading id="eligibility">3. Eligibility</SectionHeading>
          <p>To use the Platform, you must:</p>
          <ul>
            <li>Be at least 18 years of age;</li>
            <li>Have the legal capacity to enter into a binding agreement;</li>
            <li>Not be prohibited from receiving the Services under the laws of the Federal Republic of Nigeria or any other applicable jurisdiction;</li>
            <li>Provide truthful, accurate, current, and complete registration information.</li>
          </ul>
          <p>
            SolNuv is designed for solar energy professionals, engineers, EPC contractors, project developers, and companies operating in the Nigerian solar industry. Registering an account confirms you meet these requirements.
          </p>

          {/* ──────────────────────────────── 4 ──────────────────────────────── */}
          <SectionHeading id="account">4. Account Registration & Security</SectionHeading>

          <SubHeading>4.1 Account Creation</SubHeading>
          <p>
            You must register for an account to access most Platform features. You agree to provide accurate, complete, and current information during registration and to update this information as needed to maintain its accuracy.
          </p>

          <SubHeading>4.2 Phone Verification</SubHeading>
          <p>
            Account creation requires phone number verification via SMS. This is a security measure and mandatory — accounts without verified phone numbers have limited functionality.
          </p>

          <SubHeading>4.3 Account Security</SubHeading>
          <p>
            You are solely responsible for maintaining the confidentiality of your account credentials. You agree to:
          </p>
          <ul>
            <li>Choose a strong password (minimum 8 characters) and not reuse it across other services;</li>
            <li>Not share your account credentials with any other person;</li>
            <li>Immediately notify us at <a href="mailto:support@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">support@solnuv.com</a> if you suspect unauthorised access to your account;</li>
            <li>Accept responsibility for all activities that occur under your account.</li>
          </ul>
          <p>
            SolNuv shall not be liable for any loss or damage arising from your failure to safeguard your account credentials.
          </p>

          <SubHeading>4.4 Team & Organisation Accounts</SubHeading>
          <p>
            If you create or manage a company account with team members, you are responsible for all team member activity and for ensuring each member complies with these Terms. You may invite team members within the limits of your subscription plan. Revoking a team member&apos;s access does not delete their contributions made prior to removal.
          </p>

          {/* ──────────────────────────────── 5 ──────────────────────────────── */}
          <SectionHeading id="platform-services">5. Platform Services</SectionHeading>
          <p>SolNuv provides a suite of solar lifecycle management tools, including but not limited to:</p>
          <ul>
            <li><strong>Panel & Battery Valuation Calculators:</strong> Silver recovery estimates, second-life refurbishment pricing, battery recycling valuation.</li>
            <li><strong>Decommissioning Prediction:</strong> Climate-adjusted end-of-life prediction for solar equipment using West African environmental data.</li>
            <li><strong>Engineering Tools:</strong> Battery State-of-Health estimation, DC cable sizing and compliance, hybrid ROI proposal generation.</li>
            <li><strong>Project Management:</strong> Track installations, equipment, and decommission timelines.</li>
            <li><strong>NESREA EPR Compliance:</strong> Auto-generated compliance reports, cradle-to-grave tracking, and audit evidence.</li>
            <li><strong>AI-Powered Agents:</strong> Conversational AI assistants for solar guidance, project management, financial analysis, compliance reviews, and report generation — availability determined by your subscription tier.</li>
            <li><strong>Leaderboard & Analytics:</strong> Industry benchmarking and portfolio analytics.</li>
          </ul>

          <SubHeading>5.1 Service Availability</SubHeading>
          <p>
            We strive to maintain Platform availability and reliability. However, we do not guarantee uninterrupted, error-free, or always-available access. The Platform may be temporarily unavailable due to scheduled maintenance, software updates, infrastructure changes, or circumstances beyond our control. We will endeavour to give reasonable notice of planned downtime where practicable.
          </p>

          <SubHeading>5.2 Modifications to Services</SubHeading>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Services at any time, with or without notice. We are not liable to you or any third party for any modification, suspension, or discontinuation of the Services, except as expressly stated in your subscription terms.
          </p>

          {/* ──────────────────────────────── 6 ──────────────────────────────── */}
          <SectionHeading id="subscriptions">6. Subscriptions & Payment</SectionHeading>

          <SubHeading>6.1 Plans & Features</SubHeading>
          <p>
            The Platform offers tiered subscription plans (Basic, Pro, Elite, Enterprise), each with defined feature access, usage limits, and team member allowances. Plan details and pricing are displayed on our pricing page and may be updated from time to time.
          </p>

          <SubHeading>6.2 Billing & Payment</SubHeading>
          <p>
            Subscription payments are processed by <strong>Paystack</strong>, a PCI-DSS-compliant payment provider. By subscribing, you agree to:
          </p>
          <ul>
            <li>Pay all fees associated with your selected plan at the then-current prices;</li>
            <li>Provide valid and current payment information;</li>
            <li>Authorise Paystack to charge your designated payment method on a recurring basis (monthly or annually, as selected).</li>
          </ul>
          <p>
            All fees are quoted and charged in <strong>Nigerian Naira (₦)</strong> and are <strong>inclusive of applicable taxes</strong>. We reserve the right to adjust pricing with at least 30 days&apos; prior notice. Price changes take effect at the start of your next billing cycle.
          </p>

          <SubHeading>6.3 Basic Plan Limitations</SubHeading>
          <p>
            The Basic plan provides limited access with per-tool monthly usage caps (currently 7 calculations per tool type, 42 total per month). These limits may be adjusted at our discretion with reasonable notice.
          </p>

          <SubHeading>6.4 Cancellation & Refunds</SubHeading>
          <p>
            You may cancel your subscription at any time through your account Settings or by contacting support. Upon cancellation:
          </p>
          <ul>
            <li>Your access continues until the end of the current paid billing period;</li>
            <li>Your account reverts to the Basic plan;</li>
            <li>Your data is retained in accordance with our <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline">Privacy Policy</Link>.</li>
          </ul>
          <p>
            <strong>Refund policy:</strong> Subscription fees are generally non-refundable. However, if you experience a material service failure attributable to SolNuv that prevents you from using a significant portion of your paid features for more than 7 consecutive days and we are unable to resolve the issue, you may request a pro-rated refund for the affected period by emailing <a href="mailto:support@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">support@solnuv.com</a>. Refund requests are assessed on a case-by-case basis at our reasonable discretion.
          </p>

          <SubHeading>6.5 Failed Payments</SubHeading>
          <p>
            If a recurring payment fails, we will attempt to re-process the payment and may send reminders. If payment remains unsuccessful after a reasonable grace period, your subscription may be downgraded or suspended until payment is resolved.
          </p>

          {/* ──────────────────────────────── 7 ──────────────────────────────── */}
          <SectionHeading id="acceptable-use">7. Acceptable Use Policy</SectionHeading>
          <p>You agree not to use the Platform to:</p>
          <ul>
            <li>Violate any applicable law, regulation, or the rights of any third party;</li>
            <li>Submit false, misleading, or fraudulent information, including fabricated project or equipment data;</li>
            <li>Misrepresent NESREA compliance status or generate fraudulent regulatory reports;</li>
            <li>Attempt to gain unauthorised access to other user accounts, our servers, databases, or internal systems;</li>
            <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code, algorithms, or data models of the Platform;</li>
            <li>Introduce viruses, malware, or harmful code;</li>
            <li>Use automated tools (bots, scrapers, crawlers) to access the Platform without our written permission;</li>
            <li>Circumvent or manipulate usage limits, rate limiting, or subscription restrictions;</li>
            <li>Resell, redistribute, or sublicense access to the Platform or its outputs without authorisation;</li>
            <li>Use the Platform in a manner that degrades performance or adversely affects other users;</li>
            <li>Use SolNuv data, algorithms, or outputs to compete directly with SolNuv without written consent.</li>
            <li>Attempt to manipulate, exploit, or circumvent AI agent safeguards, prompt boundaries, or tier-based access restrictions;</li>
            <li>Use AI agents to generate content intended to deceive, impersonate, or mislead others;</li>
            <li>Systematically extract, scrape, or bulk-export AI agent responses for use outside the Platform.</li>
          </ul>
          <p>
            We reserve the right to investigate violations and take appropriate action, including suspending or terminating your account, removing content, and reporting illegal activity to relevant authorities.
          </p>

          {/* ──────────────────────────────── 8 ──────────────────────────────── */}
          <SectionHeading id="intellectual-property">8. Intellectual Property</SectionHeading>

          <SubHeading>8.1 SolNuv&apos;s Intellectual Property</SubHeading>
          <p>
            The Platform and all its contents — including but not limited to software, algorithms, data models, degradation formulas, climate zone databases, user interface designs, graphics, logos, trademarks, trade names (&quot;SolNuv&quot;, &quot;Fudo Greentech&quot;, &quot;Afrocarb&quot;), text, documentation, and all underlying technology — are the exclusive property of the SolNuv Group or its licensors, and are protected by Nigerian and international intellectual property laws.
          </p>
          <p>
            Your subscription grants you a limited, non-exclusive, non-transferable, revocable licence to access and use the Platform for your own internal business purposes in accordance with these Terms. This licence does not grant you any ownership interest in the Platform.
          </p>

          <SubHeading>8.2 Restrictions</SubHeading>
          <p>Except as expressly permitted in these Terms, you may not:</p>
          <ul>
            <li>Copy, reproduce, modify, or create derivative works of the Platform or any part thereof;</li>
            <li>Distribute, publicly display, or publicly perform any Platform content;</li>
            <li>Use our trademarks, logos, or trade names without prior written consent;</li>
            <li>Extract, scrape, or systematically download data from the Platform;</li>
            <li>Attempt to reconstruct our proprietary algorithms, degradation models, or climate databases.</li>
          </ul>

          <SubHeading>8.3 Feedback</SubHeading>
          <p>
            If you provide feedback, suggestions, or ideas about the Platform, you grant us an irrevocable, perpetual, worldwide, royalty-free licence to use, modify, and incorporate such feedback without any obligation to you.
          </p>

          {/* ──────────────────────────────── 9 ──────────────────────────────── */}
          <SectionHeading id="user-content">9. User Content & Data</SectionHeading>

          <SubHeading>9.1 Ownership</SubHeading>
          <p>
            You retain ownership of all User Content that you submit to the Platform. By submitting User Content, you grant us a non-exclusive, worldwide, royalty-free licence to use, store, process, and display your User Content solely for the purpose of providing and improving the Services, and as described in our Privacy Policy.
          </p>

          <SubHeading>9.2 Accuracy</SubHeading>
          <p>
            You are solely responsible for the accuracy, legality, and appropriateness of all User Content. We do not independently verify the accuracy of project data, equipment details, or installation information you submit.
          </p>

          <SubHeading>9.3 Data Portability</SubHeading>
          <p>
            You may export your project data and reports as described in the Platform features and our Privacy Policy. Upon account termination, you have 30 days to request an export of your data before it is scheduled for deletion in accordance with our retention policy.
          </p>

          <SubHeading>9.4 Aggregate & Anonymised Data</SubHeading>
          <p>
            We may create, use, and share aggregate, de-identified, or anonymised data derived from User Content for industry analytics, platform benchmarking, research, and to improve our Services. Such anonymised data cannot be used to identify you. By using the Platform, you consent to this use.
          </p>

          {/* ──────────────────────────────── 10 ──────────────────────────────── */}
          <SectionHeading id="calculators">10. Calculator & Engineering Tools</SectionHeading>

          <SubHeading>10.1 Informational Purpose Only</SubHeading>
          <p>
            All calculations, estimates, predictions, and recommendations generated by the Platform — including but not limited to panel State-of-Health (SoH), silver recovery values, second-life pricing, battery SoH, decommission dates, cable sizing results, hybrid ROI projections, soiling estimates, and climate stressor analyses — are provided for <strong>informational and planning purposes only</strong>.
          </p>

          <SubHeading>10.2 Not Professional Engineering Advice</SubHeading>
          <p>
            SolNuv outputs do <strong>not</strong> constitute professional engineering advice, licensed surveyor reports, certified electrical designs, environmental impact assessments, or financial investment recommendations. You should:
          </p>
          <ul>
            <li>Independently verify all calculations before making business, financial, or safety-critical decisions;</li>
            <li>Engage qualified, licensed professionals for final engineering design, structural analysis, and code compliance;</li>
            <li>Not rely solely on SolNuv outputs for regulatory submissions without independent professional review.</li>
          </ul>

          <SubHeading>10.3 Environmental Variables</SubHeading>
          <p>
            Our climate-adjusted models use research-backed data sourced from published studies, manufacturer datasheets, and Nigerian field observations. However, real-world conditions vary significantly due to micro-climates, installation quality, equipment manufacturing variance, grid conditions, and other factors that we cannot fully control or predict. Actual equipment performance may differ from our estimates.
          </p>
          <p>
            Our satellite irradiance data is sourced from publicly available datasets with known limitations in spatial resolution and may not fully capture micro-climate variations within specific urban or rural areas. This data should be used as a guide for system sizing rather than a precise measurement of solar resource at a given site.
          </p>

          <SubHeading>10.4 Market Prices & Financial Estimates</SubHeading>
          <p>
            Silver spot prices, material commodity values, new-panel landed costs, and all currency conversion rates used in calculations are indicative market estimates. They do not constitute price guarantees, offers to buy or sell, or financial advice. Actual transaction prices depend on negotiation, market conditions, volumes, and specific buyer/seller circumstances.
          </p>

          {/* ──────────────────────────────── 11 ──────────────────────────────── */}
          <SectionHeading id="compliance-reports">11. NESREA Compliance Reports</SectionHeading>
          <p>
            The Platform generates reports intended to assist with compliance under Nigeria&apos;s Extended Producer Responsibility (EPR) mandate and the National Environmental Standards and Regulations Enforcement Agency (NESREA) Battery Control Regulations. However:
          </p>
          <ul>
            <li>SolNuv-generated reports are <strong>tools to assist compliance</strong>, not certified or officially endorsed submissions;</li>
            <li>You remain solely responsible for the accuracy and completeness of data submitted to NESREA or any regulatory body;</li>
            <li>SolNuv does not represent or guarantee that use of the Platform ensures regulatory compliance;</li>
            <li>We are not liable for any penalties, fines, or enforcement actions resulting from regulatory submissions, whether or not they incorporate SolNuv outputs;</li>
            <li>Regulatory requirements may change — SolNuv endeavours to keep reports current but cannot guarantee immediate reflection of regulatory updates.</li>
          </ul>

          {/* ──────────────────────────────── 12 ──────────────────────────────── */}
          <SectionHeading id="ai-services">12. AI-Powered Services</SectionHeading>

          <SubHeading>12.1 Overview</SubHeading>
          <p>
            SolNuv integrates artificial intelligence (&quot;AI&quot;) agents into the Platform to provide conversational solar guidance, automated project management assistance, financial analysis, compliance reviews, and report generation. AI agents are powered by third-party large language model (LLM) providers and supplemented by SolNuv&apos;s proprietary solar domain knowledge.
          </p>

          <SubHeading>12.2 Availability by Subscription Tier</SubHeading>
          <ul>
            <li><strong>Basic & Pro plans:</strong> Access to the SolNuv AI Assistant (General Agent) for solar industry guidance, platform help, and informational queries.</li>
            <li><strong>Elite & Enterprise plans:</strong> Access to specialised Customer Agents — AI Project Manager, Financial Advisor, Compliance Officer, and Report Specialist — each scoped to your company data and projects.</li>
            <li><strong>Enterprise plans:</strong> Additional capabilities including priority processing, asynchronous task scheduling, and bulk AI task execution.</li>
          </ul>
          <p>
            Agent availability, capabilities, and quotas may be adjusted as we develop the AI features. We will provide reasonable notice of material changes.
          </p>

          <SubHeading>12.3 AI Output Disclaimer</SubHeading>
          <p>
            All AI agent responses are generated by machine learning models and are <strong>provided for informational and planning purposes only</strong>. AI outputs:
          </p>
          <ul>
            <li>Do <strong>not</strong> constitute professional engineering advice, financial recommendations, legal counsel, or certified compliance assessments;</li>
            <li>May contain inaccuracies, hallucinations (plausible but incorrect information), or outdated information due to knowledge cut-off dates;</li>
            <li>May produce different responses for identical or similar queries across different sessions;</li>
            <li>Must be independently verified before making business, financial, safety-critical, or regulatory decisions;</li>
            <li>Are not guaranteed to be consistent, reproducible, or free from bias.</li>
          </ul>
          <p>
            You acknowledge that AI technology is inherently probabilistic and that SolNuv bears no liability for decisions made based on AI agent output.
          </p>

          <SubHeading>12.4 AI Data Processing</SubHeading>
          <p>
            To provide AI services, conversation messages and relevant project context are transmitted to our LLM providers (currently Google Gemini and Groq). These providers process your queries in real time and do not retain your data for their own training purposes under our data processing agreements. AI conversation logs are stored on our systems for service improvement, audit, and support purposes — see our <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline">Privacy Policy</Link> for retention details.
          </p>

          <SubHeading>12.5 Prohibited AI Usage</SubHeading>
          <p>In addition to the restrictions in Section 7, you agree not to:</p>
          <ul>
            <li>Attempt to extract, reconstruct, or reverse-engineer the system prompts, configuration, or internal instructions of any AI agent;</li>
            <li>Use AI agents to generate harmful, illegal, defamatory, or misleading content;</li>
            <li>Present AI-generated outputs as certified professional work product without independent professional review;</li>
            <li>Use the AI features to build, train, or improve competing AI products or services.</li>
          </ul>

          <SubHeading>12.6 AI & Technology Limitations</SubHeading>

          <SubHeading>12.6.1 Machine Learning Model Limitations</SubHeading>
          <p>
            SolNuv&apos;s engineering tools and AI agents are powered by machine learning models and proprietary algorithms. These models:
          </p>
          <ul>
            <li>Are trained on historical data and may not accurately predict future conditions;</li>
            <li>Have inherent uncertainty margins that are disclosed where applicable;</li>
            <li>Depend on the quality and representativeness of underlying training data;</li>
            <li>May produce different outputs for identical inputs across different sessions due to probabilistic nature;</li>
            <li>Are periodically updated; older results may not reflect current model versions.</li>
          </ul>

          <SubHeading>12.6.2 Degradation & Lifespan Predictions</SubHeading>
          <p>
            Our decommission date predictions and degradation models use:
          </p>
          <ul>
            <li>Published degradation rates from manufacturer datasheets;</li>
            <li>Climate zone classifications based on geographic region;</li>
            <li>Statistical projections that cannot account for individual installation variance;</li>
            <li>Estimates for real-world factors such as soiling, shading, temperature, and maintenance.</li>
          </ul>
          <p>
            Actual equipment performance depends on site-specific conditions we cannot fully model. Predictions should be treated as planning benchmarks, not guarantees.
          </p>

          <SubHeading>12.6.3 Market Price & Financial Estimates</SubHeading>
          <p>
            All commodity prices, equipment costs, and financial projections are indicative estimates based on:
          </p>
          <ul>
            <li>Published market data and research studies;</li>
            <li>Regional cost benchmarks;</li>
            <li>General industry assumptions.</li>
          </ul>
          <p>
            These estimates do not constitute financial advice, price quotes, or contractual offers. Actual transaction prices depend on negotiation, supplier relationships, volumes, and market conditions at the time of purchase or sale.
          </p>

          <SubHeading>12.6.4 AI Response Variability</SubHeading>
          <p>
            AI agent responses may vary in:
          </p>
          <ul>
            <li>Tone, format, and depth of analysis;</li>
            <li>Accuracy of technical information;</li>
            <li>Recommendations and conclusions drawn.</li>
          </ul>
          <p>
            Users should verify all technical, financial, and compliance information before making decisions. AI responses are one input among many for professional judgment.
          </p>

          {/* ──────────────────────────────── 13 ──────────────────────────────── */}
          <SectionHeading id="third-party">13. Third-Party Services</SectionHeading>
          <p>
            The Platform integrates with third-party services (Paystack, Supabase, Brevo, Termii, Google OAuth, Google Gemini AI, Groq AI) and may contain links to third-party websites. These services are governed by their own terms of service and privacy policies. We do not control, endorse, or assume responsibility for third-party services. Your interactions with third parties are solely between you and them.
          </p>

          {/* ──────────────────────────────── 14 ──────────────────────────────── */}
          <SectionHeading id="disclaimers">14. Disclaimers & No Warranties</SectionHeading>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 my-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">IMPORTANT — PLEASE READ CAREFULLY</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE PLATFORM AND ALL SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY.
            </p>
          </div>
          <p>The SolNuv Group expressly disclaims all warranties, including but not limited to:</p>
          <ul>
            <li>Implied warranties of merchantability, fitness for a particular purpose, and non-infringement;</li>
            <li>Any warranty that the Platform will meet your specific requirements, be uninterrupted, timely, secure, or error-free;</li>
            <li>Any warranty regarding the accuracy, reliability, or completeness of any calculations, estimates, predictions, or recommendations;</li>
            <li>Any warranty regarding the accuracy, completeness, or reliability of AI agent outputs, including but not limited to project analyses, financial estimates, compliance assessments, and generated reports;</li>
            <li>Any warranty arising from course of dealing, usage, or trade practice.</li>
          </ul>
          <p>
            No advice or information, whether oral or written, obtained from SolNuv or through the Platform creates any warranty not expressly stated in these Terms.
          </p>

          {/* ──────────────────────────────── 15 ──────────────────────────────── */}
          <SectionHeading id="limitation">15. Limitation of Liability</SectionHeading>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 my-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              TO THE MAXIMUM EXTENT PERMITTED BY NIGERIAN LAW AND OTHER APPLICABLE LAW:
            </p>
          </div>

          <SubHeading>15.1 Exclusion of Consequential Damages</SubHeading>
          <p>
            IN NO EVENT SHALL THE SOLNUV GROUP BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>Loss of profits, revenue, business, or anticipated savings;</li>
            <li>Loss of data or data corruption;</li>
            <li>Loss of goodwill or reputation;</li>
            <li>Equipment damage, downtime, or failure based on SolNuv recommendations;</li>
            <li>Regulatory penalties, fines, or enforcement actions;</li>
            <li>Cost of procurement of substitute goods or services;</li>
          </ul>
          <p>
            — whether arising from contract, tort (including negligence), strict liability, or any other legal theory, even if SolNuv has been advised of the possibility of such damages.
          </p>

          <SubHeading>15.2 Aggregate Cap</SubHeading>
          <p>
            THE TOTAL AGGREGATE LIABILITY OF THE SOLNUV GROUP FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF:
          </p>
          <ul>
            <li>The total fees you paid to SolNuv in the twelve (12) months immediately preceding the event giving rise to the claim; or</li>
            <li>Fifty thousand Nigerian Naira (₦50,000).</li>
          </ul>

          <SubHeading>15.3 Essential Basis</SubHeading>
          <p>
            You acknowledge that the limitations and disclaimers in Sections 14 and 15 are an essential basis of the bargain between you and SolNuv, that they allocate risk in a manner that both parties consider fair and reasonable, and that SolNuv would not enter into these Terms without such limitations.
          </p>

          <SubHeading>15.4 Statutory Rights</SubHeading>
          <p>
            Nothing in these Terms shall exclude or limit liability that cannot be lawfully excluded or limited under Nigerian law, including liability for death or personal injury caused by negligence, fraud, or fraudulent misrepresentation.
          </p>

          {/* ──────────────────────────────── 16 ──────────────────────────────── */}
          <SectionHeading id="indemnification">16. Indemnification</SectionHeading>
          <p>
            You agree to indemnify, defend, and hold harmless the SolNuv Group from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to:
          </p>
          <ul>
            <li>Your use or misuse of the Platform;</li>
            <li>Your violation of these Terms or any applicable law;</li>
            <li>Your User Content, including any inaccurate project or equipment data;</li>
            <li>Regulatory submissions or compliance filings incorporating SolNuv outputs;</li>
            <li>Your infringement of any third-party rights;</li>
            <li>Claims by your employees, team members, clients, or end-users arising from reliance on SolNuv outputs.</li>
          </ul>
          <p>
            We will notify you of any such claim and reasonably cooperate in the defence. You shall not settle any claim without our prior written consent.
          </p>

          {/* ──────────────────────────────── 17 ──────────────────────────────── */}
          <SectionHeading id="termination">17. Termination</SectionHeading>

          <SubHeading>17.1 Termination by You</SubHeading>
          <p>
            You may terminate your account at any time through your account Settings or by emailing <a href="mailto:support@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">support@solnuv.com</a>. If you have an active paid subscription, cancellation takes effect at the end of the current billing period.
          </p>

          <SubHeading>17.2 Termination by SolNuv</SubHeading>
          <p>We may suspend or terminate your account immediately if:</p>
          <ul>
            <li>You breach any provision of these Terms;</li>
            <li>You engage in fraudulent, illegal, or harmful activity;</li>
            <li>We are required to do so by law, court order, or regulatory mandate;</li>
            <li>Your account has been inactive for more than 24 consecutive months;</li>
            <li>We reasonably believe your continued access poses a security risk to the Platform or other users.</li>
          </ul>
          <p>
            Where practicable, we will provide notice and an opportunity to cure the breach before termination, except where immediate suspension is necessary to protect the Platform or comply with law.
          </p>

          <SubHeading>17.3 Effect of Termination</SubHeading>
          <p>Upon termination:</p>
          <ul>
            <li>Your right to access the Platform and Services immediately ceases (or at end of billing period for voluntary cancellation);</li>
            <li>You have 30 days from the date of termination to request an export of your data;</li>
            <li>We will retain your data in accordance with the retention periods in our <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline">Privacy Policy</Link>;</li>
            <li>Sections 8, 9.4, 12, 14, 15, 16, 18, and 20 survive termination.</li>
          </ul>

          {/* ──────────────────────────────── 18 ──────────────────────────────── */}
          <SectionHeading id="dispute">18. Dispute Resolution & Governing Law</SectionHeading>

          <SubHeading>18.1 Governing Law</SubHeading>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the <strong>Federal Republic of Nigeria</strong>, without regard to its conflict of laws provisions.
          </p>

          <SubHeading>18.2 Informal Resolution</SubHeading>
          <p>
            Before initiating formal proceedings, you agree to first attempt to resolve any dispute informally by contacting us at <a href="mailto:legal@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">legal@solnuv.com</a>. We will endeavour to resolve disputes within 30 days of receiving your written notice.
          </p>

          <SubHeading>18.3 Mediation</SubHeading>
          <p>
            If informal resolution fails, the parties agree to attempt mediation administered by the Lagos Multi-Door Courthouse (LMDC) or another mutually agreed mediation centre. Mediation costs shall be shared equally unless otherwise agreed.
          </p>

          <SubHeading>18.4 Arbitration</SubHeading>
          <p>
            If mediation is unsuccessful within 60 days, either party may refer the dispute to binding arbitration under the <strong>Arbitration and Mediation Act 2023</strong> of Nigeria. The arbitration shall be:
          </p>
          <ul>
            <li>Conducted in English;</li>
            <li>Held in Lagos, Nigeria (or remotely, by mutual agreement);</li>
            <li>Decided by a sole arbitrator appointed by mutual agreement, or failing agreement, by the Lagos Court of Arbitration;</li>
            <li>The arbitral award shall be final, binding, and enforceable in any court of competent jurisdiction.</li>
          </ul>

          <SubHeading>18.5 Class Action Waiver</SubHeading>
          <p>
            To the maximum extent permitted by law, you agree that any dispute resolution proceedings will be conducted on an individual basis and not as part of a class, consolidated, or representative action.
          </p>

          <SubHeading>18.6 Jurisdiction</SubHeading>
          <p>
            For any matters not subject to arbitration, the courts of Lagos State, Nigeria, shall have exclusive jurisdiction.
          </p>

          {/* ──────────────────────────────── 19 ──────────────────────────────── */}
          <SectionHeading id="force-majeure">19. Force Majeure</SectionHeading>
          <p>
            SolNuv shall not be liable for any failure or delay in performing its obligations under these Terms where such failure or delay results from circumstances beyond our reasonable control, including but not limited to: natural disasters, pandemic, war, terrorism, civil unrest, power outages, telecommunications failures, internet disruptions, government actions, strikes, fire, flood, or acts of God. In such events, our obligations are suspended for the duration of the force majeure event.
          </p>

          {/* ──────────────────────────────── 20 ──────────────────────────────── */}
          <SectionHeading id="general">20. General Provisions</SectionHeading>

          <SubHeading>20.1 Entire Agreement</SubHeading>
          <p>
            These Terms, together with the <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline">Privacy Policy</Link>, constitute the entire agreement between you and SolNuv regarding the subject matter hereof and supersede all prior or contemporaneous understandings, proposals, or agreements, whether oral or written.
          </p>

          <SubHeading>20.2 Severability</SubHeading>
          <p>
            If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the original intent.
          </p>

          <SubHeading>20.3 Waiver</SubHeading>
          <p>
            Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right or provision. A waiver of any term shall be effective only if in writing and signed by an authorised representative of SolNuv.
          </p>

          <SubHeading>20.4 Assignment</SubHeading>
          <p>
            You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations without restriction, including in connection with a merger, acquisition, or sale of assets.
          </p>

          <SubHeading>20.5 Notices</SubHeading>
          <p>
            Notices to SolNuv must be sent to <a href="mailto:legal@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">legal@solnuv.com</a>. Notices to you may be sent to the email address associated with your account. Email notices are deemed received 24 hours after sending.
          </p>

          <SubHeading>20.6 No Third-Party Beneficiaries</SubHeading>
          <p>
            These Terms do not create any third-party beneficiary rights, except that members of the SolNuv Group (Fudo Greentech, affiliates, subsidiaries, and their respective officers, directors, employees, and agents) are intended third-party beneficiaries of the disclaimers, limitations, and indemnification provisions herein and may enforce such provisions directly.
          </p>

          <SubHeading>20.7 Headings</SubHeading>
          <p>
            Section headings are for convenience only and do not affect the interpretation of these Terms.
          </p>

          {/* ──────────────────────────────── 21 ──────────────────────────────── */}
          <SectionHeading id="changes">21. Changes to These Terms</SectionHeading>
          <p>
            We may revise these Terms from time to time. When we make material changes:
          </p>
          <ul>
            <li>We will update the &quot;Last updated&quot; date at the top of this page;</li>
            <li>We will notify you via email or a prominent banner on the Platform at least 14 days before the changes take effect;</li>
            <li>For changes that materially affect paid subscription terms, we will provide at least 30 days&apos; notice;</li>
            <li>Your continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</li>
          </ul>
          <p>
            If you do not agree to the updated Terms, you must stop using the Platform and may cancel your subscription without penalty during the notice period.
          </p>

          {/* ──────────────────────────────── 22 ──────────────────────────────── */}
          <SectionHeading id="contact">22. Contact Information</SectionHeading>
          <p>For questions about these Terms, contact us:</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 mt-3 space-y-2">
            <p><strong>Fudo Greentech Limited</strong> (trading as SolNuv)</p>
            <p>Lagos, Nigeria</p>
            <p>Legal enquiries: <a href="mailto:legal@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">legal@solnuv.com</a></p>
            <p>General support: <a href="mailto:support@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">support@solnuv.com</a></p>
            <p>Compliance: <a href="mailto:compliance@solnuv.com" className="text-forest-600 dark:text-emerald-400 underline">compliance@solnuv.com</a></p>
            <p>Phone / WhatsApp: <a href="tel:+2348135244971" className="text-forest-600 dark:text-emerald-400 underline">+234 813 5244 971</a></p>
          </div>

          {/* Closing */}
          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Fudo Greentech Limited (SolNuv). All rights reserved. Powered by Fudo Greentech · Afrocarb.
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <Link href="/privacy" className="text-forest-600 dark:text-emerald-400 underline hover:text-forest-800 dark:hover:text-emerald-300">Privacy Policy</Link>
              <Link href="/contact" className="text-forest-600 dark:text-emerald-400 underline hover:text-forest-800 dark:hover:text-emerald-300">Contact Us</Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}

TermsOfService.getLayout = getPublicLayout;
