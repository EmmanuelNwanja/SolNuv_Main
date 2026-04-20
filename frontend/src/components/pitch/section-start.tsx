export function SectionStart() {
  return (
    <div className="min-h-[100svh]">
      <span className="absolute right-4 md:right-8 top-4 text-sm md:text-lg text-emerald-300">
        Investor narrative · 2026
      </span>

      <div className="container min-h-[100svh] relative pt-20 pb-28 md:py-0">
        <div className="absolute top-24 left-2 scale-[0.4] sm:scale-50 md:scale-100 md:top-auto md:bottom-[650px] md:left-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={193}
            height={193}
            fill="none"
          >
            <path
              fill="#fff"
              fillRule="evenodd"
              d="M91.945 0C77.468.619 63.82 4.437 51.69 10.765l40.256 69.727V0Zm0 111.762-40.254 69.724a95.696 95.696 0 0 0 40.254 10.764v-80.488Zm8.367 80.487v-80.533l40.274 69.756c-12.135 6.335-25.79 10.157-40.274 10.777Zm0-111.71V0c14.485.62 28.14 4.443 40.276 10.778l-40.276 69.76Zm-85.343 67.288 69.74-40.265-40.26 69.735a96.722 96.722 0 0 1-29.48-29.47ZM177.297 44.446l-69.73 40.258 40.262-69.735a96.727 96.727 0 0 1 29.468 29.477Zm-162.336-.01a96.723 96.723 0 0 1 29.485-29.482l40.275 69.758-69.76-40.276Zm-4.19 7.242C4.438 63.815.617 77.472 0 91.958h80.539L10.77 51.678Zm.007 88.908C4.445 128.454.623 114.804.001 100.324h80.511l-69.734 40.262Zm100.958-48.628h80.515a95.684 95.684 0 0 0-10.766-40.27l-69.749 40.27Zm69.742 48.617-69.715-40.251h80.486c-.621 14.476-4.441 28.122-10.771 40.251Zm-73.899-33.005 40.248 69.711a96.712 96.712 0 0 0 29.461-29.465l-69.709-40.246Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="absolute bottom-28 left-2 md:left-auto md:right-0 md:bottom-8 text-[clamp(4rem,22vw,26rem)] leading-none font-display bg-gradient-to-r from-emerald-300 via-white to-amber-300 bg-clip-text text-transparent">
          SolNuv
        </h1>
        <p className="absolute bottom-10 left-2 right-2 md:left-auto md:right-8 md:bottom-[5.5rem] max-w-xl text-left md:text-right text-xs md:text-sm text-white/55 leading-snug">
          The homepage sells the product. This deck sells the category: AI-native trust and execution for solar—before capital, procurement, and compliance harden their positions.
        </p>
      </div>
    </div>
  );
}
