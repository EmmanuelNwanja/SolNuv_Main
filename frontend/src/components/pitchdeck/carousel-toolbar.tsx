import { RiArrowLeftLine, RiArrowRightLine, RiExternalLinkLine } from "react-icons/ri";

type CarouselToolbarProps = {
  current: number;
  total: number;
  views: number;
  onPrev: () => void;
  onNext: () => void;
};

function popupCenter(url: string, title: string, w: number, h: number) {
  if (typeof window === "undefined") return null;
  const dualScreenLeft = window.screenLeft ?? window.screenX;
  const dualScreenTop = window.screenTop ?? window.screenY;
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const systemZoom = width / window.screen.availWidth;
  const left = (width - w) / 2 / systemZoom + dualScreenLeft;
  const top = (height - h) / 2 / systemZoom + dualScreenTop;
  return window.open(
    url,
    title,
    `scrollbars=yes,width=${w / systemZoom},height=${h / systemZoom},top=${top},left=${left}`,
  );
}

export function CarouselToolbar({ current, total, views, onPrev, onNext }: CarouselToolbarProps) {
  function handleShare() {
    const tweet = encodeURIComponent(
      "Explore SolNuv's pitch deck: lifecycle intelligence for solar teams and partners.",
    );
    const link = encodeURIComponent("https://solnuv.com/pitch");
    const popup = popupCenter(`https://twitter.com/intent/tweet?text=${tweet}&url=${link}`, "Share", 860, 420);
    popup?.focus();
  }

  return (
    <div className="fixed left-0 right-0 bottom-3 z-40 px-3 sm:px-5">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-[0_10px_35px_rgba(2,8,23,0.15)] p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {current} / {total}
            </span>
            <span className="text-xs text-slate-500">
              {Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(views)} views
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RiArrowLeftLine /> Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Next <RiArrowRightLine />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1 rounded-lg bg-forest-900 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-800"
            >
              Share <RiExternalLinkLine />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
