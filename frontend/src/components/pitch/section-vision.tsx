import Link from "next/link";

export function SectionVision() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>North star</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container pt-20 md:pt-0 pb-28 md:pb-0">
        <h1 className="text-[clamp(2rem,10vw,7.625rem)] px-4 md:px-0 font-medium text-center leading-none">
          Become the default trust layer for solar execution.
        </h1>
      </div>
    </div>
  );
}
