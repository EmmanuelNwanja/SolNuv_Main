import Head from "next/head";
import { useRouter } from "next/router";
import { getDashboardLayout } from "../components/Layout";
import { RiBankLine, RiArrowLeftLine } from "react-icons/ri";

export default function PaymentComingSoon() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Paystack Payments — Coming Soon | SolNuv</title>
      </Head>

      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <RiBankLine className="text-slate-400" size={32} />
        </div>

        <span className="inline-block text-xs font-semibold bg-slate-100 text-slate-500 px-3 py-1 rounded-full mb-4 tracking-wide">
          Coming Soon
        </span>
        <h1 className="font-display font-bold text-2xl text-slate-800 mb-3">Paystack Payments Unavailable</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Online card and USSD payment via Paystack is not yet available on SolNuv.
          <br className="hidden sm:block" />
          Please use <strong className="text-slate-700">Direct Bank Transfer</strong> to activate your plan, or
          contact our support team for assistance.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <RiArrowLeftLine size={16} />
            Go Back
          </button>
          <a
            href="mailto:support@solnuv.com"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-forest-900 text-white font-semibold text-sm hover:bg-forest-800 transition-colors"
          >
            Contact Support
          </a>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          Need help? Email us at{" "}
          <a href="mailto:support@solnuv.com" className="text-forest-900 hover:underline">
            support@solnuv.com
          </a>
        </p>
      </div>
    </>
  );
}

PaymentComingSoon.getLayout = getDashboardLayout;
