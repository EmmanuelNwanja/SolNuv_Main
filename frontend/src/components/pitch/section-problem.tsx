import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const receiptImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/reciept.png";

export function SectionProblem() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Current problem</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="space-y-8">
            <Card className="border-emerald-500/35 bg-forest-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" width={60} height={68} fill="none">
                <path
                  fill="#F5F5F3"
                  d="M0 67.333V.667l5 5 5-5 5 5 5-5 5 5 5-5 5 5 5-5 5 5 5-5 5 5 5-5v66.666l-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5Zm10-16.666h40V44H10v6.667Zm0-13.334h40v-6.666H10v6.666ZM10 24h40v-6.667H10V24ZM6.667 57.667h46.666V10.333H6.667v47.334Z"
                />
              </svg>
              <h2 className="text-2xl font-display text-emerald-100">Disorganization</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                Running a business is tough, and one of the biggest challenges is
                disorganization. From scattered files to misplaced documents, this
                lack of structure hampers productivity and wastes time.
              </p>
            </Card>
            <div className="px-2 md:px-8">
              <h2 className="text-3xl sm:text-5xl md:text-6xl text-center leading-tight font-display text-amber-100">
                The current market for SMB financial tools is a mess.
              </h2>
            </div>
          </div>
          <div>
            <Image src={receiptImage} alt="Receipt" width={650} height={875} quality={100} />
          </div>
          <div className="ml-auto w-full space-y-8">
            <Card className="min-h-[260px] md:min-h-[315px] border-amber-500/35 bg-amber-900/15">
              <svg xmlns="http://www.w3.org/2000/svg" width={80} height={80} fill="none">
                <mask
                  id="problemMaskA"
                  width={80}
                  height={80}
                  x={0}
                  y={0}
                  maskUnits="userSpaceOnUse"
                  style={{ maskType: "alpha" }}
                >
                  <path fill="#D9D9D9" d="M0 0h80v80H0z" />
                </mask>
                <g mask="url(#problemMaskA)">
                  <path
                    fill="#F5F5F3"
                    d="M56.667 70C53 70 49.86 68.695 47.25 66.083c-2.611-2.61-3.917-5.75-3.917-9.416 0-3.667 1.306-6.806 3.917-9.417 2.611-2.611 5.75-3.917 9.417-3.917 3.666 0 6.805 1.306 9.416 3.917C68.694 49.861 70 53 70 56.667c0 3.666-1.306 6.805-3.917 9.416-2.61 2.612-5.75 3.917-9.416 3.917Zm0-6.667c1.833 0 3.402-.652 4.708-1.958s1.958-2.875 1.958-4.708c0-1.834-.652-3.403-1.958-4.709C60.069 50.653 58.5 50 56.667 50c-1.834 0-3.403.653-4.709 1.958C50.653 53.264 50 54.833 50 56.667c0 1.833.653 3.402 1.958 4.708 1.306 1.306 2.875 1.958 4.709 1.958ZM23.333 60c-3.666 0-6.805-1.306-9.416-3.917-2.611-2.61-3.917-5.75-3.917-9.416 0-3.667 1.306-6.806 3.917-9.417 2.61-2.611 5.75-3.917 9.416-3.917 3.667 0 6.806 1.306 9.417 3.917 2.611 2.611 3.917 5.75 3.917 9.417 0 3.666-1.306 6.805-3.917 9.416C30.139 58.694 27 60 23.333 60Zm0-6.667c1.834 0 3.403-.652 4.709-1.958C29.347 50.069 30 48.5 30 46.667c0-1.834-.653-3.403-1.958-4.709C26.736 40.653 25.167 40 23.333 40c-1.833 0-3.402.653-4.708 1.958-1.306 1.306-1.958 2.875-1.958 4.709 0 1.833.652 3.402 1.958 4.708s2.875 1.958 4.708 1.958Zm13.334-20c-3.667 0-6.806-1.305-9.417-3.916-2.611-2.611-3.917-5.75-3.917-9.417s1.306-6.806 3.917-9.417c2.611-2.61 5.75-3.916 9.417-3.916 3.666 0 6.805 1.305 9.416 3.916C48.694 13.194 50 16.333 50 20s-1.306 6.806-3.917 9.417c-2.61 2.61-5.75 3.916-9.416 3.916Zm0-6.666c1.833 0 3.402-.653 4.708-1.959 1.306-1.305 1.958-2.875 1.958-4.708 0-1.833-.652-3.403-1.958-4.708-1.306-1.306-2.875-1.959-4.708-1.959-1.834 0-3.403.653-4.709 1.959C30.653 16.597 30 18.167 30 20c0 1.833.653 3.403 1.958 4.708 1.306 1.306 2.875 1.959 4.709 1.959Z"
                  />
                </g>
              </svg>
              <h2 className="text-2xl font-display text-amber-100">Scattered workflow</h2>
              <p className="text-amber-50/75 text-sm text-center">
                Existing services often compound the problem by residing on various
                platforms, resulting in a fragmented workflow. This scattered
                approach wastes time and money.
              </p>
            </Card>
            <Card className="min-h-[260px] md:min-h-[315px] border-emerald-500/25 bg-slate-900/80">
              <svg xmlns="http://www.w3.org/2000/svg" width={80} height={80} fill="none">
                <mask
                  id="problemMaskB"
                  width={80}
                  height={80}
                  x={0}
                  y={0}
                  maskUnits="userSpaceOnUse"
                  style={{ maskType: "alpha" }}
                >
                  <path fill="#D9D9D9" d="M0 0h80v80H0z" />
                </mask>
                <g mask="url(#problemMaskB)">
                  <path
                    fill="#F5F5F3"
                    d="M13.333 66.667c-1.833 0-3.402-.653-4.708-1.959C7.319 63.403 6.667 61.833 6.667 60V20c0-1.833.652-3.403 1.958-4.708 1.306-1.306 2.875-1.959 4.708-1.959h53.334c1.833 0 3.402.653 4.708 1.959 1.305 1.305 1.958 2.875 1.958 4.708v40c0 1.833-.653 3.403-1.958 4.708-1.306 1.306-2.875 1.959-4.708 1.959H13.333Zm0-6.667h53.334V26.667H13.333V60ZM25 56.667 20.333 52l8.584-8.667-8.667-8.666L25 30l13.333 13.333L25 56.667Zm15 0V50h20v6.667H40Z"
                  />
                </g>
              </svg>
              <h2 className="text-2xl font-display text-slate-100">Old tech</h2>
              <p className="text-slate-300 text-sm text-center">
                Services are outdated and prioritize features tailored to specialists
                rather than offering a user-friendly interface for business owners.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
