import Link from "next/link";
import { CalEmbed } from "../cal-embed";
import { Button } from "../ui/button";

export function SectionBook() {
  return (
    <div className="min-h-screen relative w-screen">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-lg">
        <span>Book a meeting</span>
        <Link href="/register">
          <Button variant="outline">Sign up</Button>
        </Link>
      </div>
      <div className="flex flex-col min-h-screen justify-center container">
        <div className="h-[400px] md:h-[600px] px-4 md:px-0 text-center flex flex-col items-center justify-center">
          <CalEmbed calLink="pontus-midday/30min" />
        </div>
      </div>
    </div>
  );
}
