import Link from "next/link";
import { CalEmbed } from "../cal-embed";
import { Button } from "../ui/button";

export function SectionBook() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between items-center gap-3 text-sm md:text-lg">
        <span>Book a meeting</span>
        <Link href="/register">
          <Button variant="outline" className="h-9 px-3 text-xs sm:text-sm sm:h-10 sm:px-4">Sign up</Button>
        </Link>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="min-h-[360px] h-[58svh] md:h-[600px] px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0 text-center flex flex-col items-center justify-center">
          <CalEmbed calLink="pontus-midday/30min" />
        </div>
      </div>
    </div>
  );
}
