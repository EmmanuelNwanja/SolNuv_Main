import Head from 'next/head';
import Link from 'next/link';
import { RiWifiOffLine, RiArrowLeftLine, RiSunLine } from 'react-icons/ri';

export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>Offline - SolNuv</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <RiWifiOffLine className="w-10 h-10 text-emerald-600" />
          </div>
          
          <h1 className="text-2xl font-display font-bold text-forest-900 mb-2">
            You are offline
          </h1>
          
          <p className="text-slate-600 mb-6">
            SolNuv needs an internet connection to load new content. 
            Some cached pages may still be available.
          </p>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-6">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <RiSunLine className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Cached calculations saved
                </p>
                <p className="text-xs text-slate-500">
                  Your saved calculations are stored locally and will sync when you reconnect.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Try Again
            </button>
            
            <Link
              href="/dashboard"
              className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <RiArrowLeftLine className="w-4 h-4" />
                Return to Dashboard
              </span>
            </Link>
          </div>
          
          <p className="text-xs text-slate-400 mt-8">
            Check your connection and try again. SolNuv works best with a stable internet connection.
          </p>
        </div>
      </div>
      
      <style jsx global>{`
        body {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
        }
      `}</style>
    </>
  );
}
