import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import {
  RiPhoneLine, RiMailLine, RiMapPinLine, RiSendPlaneLine,
  RiCheckLine, RiArrowRightLine, RiWhatsappLine, RiTimeLine,
} from 'react-icons/ri';
import { contactAPI } from '../services/api';
import { getPublicLayout } from '../components/Layout';
import { MotionItem, MotionSection, MotionStagger } from '../components/PageMotion';

const SUBJECTS = [
  'General Enquiry',
  'Technical Support',
  'Billing & Subscription',
  'Partnership / Integration',
  'Investment Enquiry',
  'Enterprise / White-Label',
  'Report a Bug',
  'Sales',
  'Other',
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.message) {
      setError('Please fill in all required fields.');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await contactAPI.submit(form);
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send message. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Contact Us — SolNuv | Partnerships, Support &amp; Enterprise Sales</title>
        <meta name="description" content="Get in touch with the SolNuv team for technical support, partnership opportunities, enterprise licensing, investment enquiries, or product feedback. We respond within 24 hours." />
      </Head>

      <MotionSection className="marketing-section marketing-section-animated">
        <MotionStagger className="max-w-4xl mx-auto text-center" delay={0.03}>
          <span className="marketing-kicker">Contact SolNuv</span>
          <h1 className="marketing-headline">Talk to product, support, or partnerships</h1>
          <p className="marketing-subcopy mx-auto">
            Reach the team for implementation support, partner collaboration, enterprise procurement, or platform onboarding guidance.
          </p>
        </MotionStagger>
      </MotionSection>

      <MotionSection className="marketing-section marketing-section-animated">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Contact info */}
          <MotionStagger className="lg:col-span-2 space-y-8" delay={0.06}>
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-5">Contact Information</h2>
              <div className="space-y-4">
                <a
                  href="tel:+2348135244971"
                  className="flex items-start gap-3 group"
                >
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <RiPhoneLine className="text-lg" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">Phone / WhatsApp</p>
                    <p className="text-slate-800 dark:text-slate-100 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">+234 813 5244 971</p>
                  </div>
                </a>

                <a
                  href="mailto:support@solnuv.com"
                  className="flex items-start gap-3 group"
                >
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <RiMailLine className="text-lg" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">Email</p>
                    <p className="text-slate-800 dark:text-slate-100 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">support@solnuv.com</p>
                  </div>
                </a>

                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                    <RiTimeLine className="text-lg" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">Response Time</p>
                    <p className="text-slate-800 dark:text-slate-100 font-medium">Within 24 hours on business days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/2348135244971"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold transition-colors w-full justify-center"
            >
              <RiWhatsappLine className="text-xl" />
              Chat on WhatsApp
            </a>

            {/* Quick links */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Links</p>
              {[
                { label: 'View Plans & Pricing', href: '/pricing' },
                { label: 'Explore the Platform', href: '/#how-it-works' },
                { label: 'Read our Blog', href: '/blog' },
                { label: 'Get Started', href: '/register' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 hover:text-forest-900 dark:hover:text-emerald-400 transition-colors py-1"
                >
                  {label}
                  <RiArrowRightLine />
                </Link>
              ))}
            </div>
          </MotionStagger>

          {/* Form */}
          <MotionItem className="lg:col-span-3">
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-slate-900 dark:border-emerald-800 h-full">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 text-3xl mb-4">
                  <RiCheckLine />
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Message Sent!</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm">
                  Thanks for reaching out. We'll get back to you at <strong>{form.email}</strong> within 24 hours.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }); }}
                  className="mt-6 text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-7 space-y-5">
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Send a Message</h2>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone (optional)</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="+234 800 0000 000"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                    <select
                      id="subject"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                      <option value="">Select a topic</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    value={form.message}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-forest-900 hover:bg-forest-800 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : <><RiSendPlaneLine /> Send Message</>}
                </button>

                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  We typically respond within 24 business hours.
                </p>
              </form>
            )}
          </MotionItem>
        </div>
      </MotionSection>
      <MotionSection className="marketing-section-dark marketing-section-animated text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Ready to start?</span>
        <h2 className="font-display font-bold text-3xl text-white mt-3">Open your SolNuv workspace</h2>
        <p className="text-white/75 max-w-2xl mx-auto mt-3">
          Create your account to begin design workflows immediately, or continue with enterprise onboarding through the partnerships team.
        </p>
        <div className="marketing-cta-row justify-center">
          <Link href="/register" className="btn-amber inline-flex items-center gap-2">
            Create account <RiArrowRightLine />
          </Link>
          <Link href="/pricing" className="btn-outline border-white/30 text-white hover:bg-white/10">
            Compare plans
          </Link>
        </div>
      </MotionSection>
    </>
  );
}

ContactPage.getLayout = getPublicLayout;
