"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useMediaQuery } from "../../hooks/use-media-query";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";

const ReactHlsPlayer = dynamic(() => import("react-hls-player"), {
  ssr: false,
  loading: () => <p>Loading...</p>,
});

type Props = {
  playVideo: boolean;
};

export function SectionDemo({ playVideo }: Props) {
  const playerRef = useRef<any>();
  const [isPlaying, setPlaying] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useHotkeys("space", () => {
    togglePlay();
  });

  useHotkeys("backspace", () => {
    handleRestart();
  });

  useEffect(() => {
    if (isDesktop) {
      if (playVideo) {
        togglePlay();
      } else {
        togglePlay();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playVideo, isDesktop]);

  const handleRestart = () => {
    if (playerRef.current) {
      playerRef.current.currentTime = 0;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }

    setPlaying((prev) => !prev);
  };

  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg gap-3">
        <span className="truncate">Product walkthrough · private beta</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="group pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="absolute top-[50%] left-[50%] w-[200px] h-[50px] -ml-[100px] -mt-[50px] group-hover:opacity-100 hidden lg:flex space-x-4 items-center justify-center opacity-0 z-30 transition-all">
            <Button
              size="icon"
              className="rounded-full w-14 h-14 bg-transparent border border-white text-white hover:bg-transparent"
              onClick={handleRestart}
            >
              <Icons.Reply size={24} />
            </Button>
            <Button size="icon" className="rounded-full w-14 h-14" onClick={togglePlay}>
              {isPlaying ? <Icons.PauseOutline size={24} /> : <Icons.PlayOutline size={24} />}
            </Button>
          </div>
          <ReactHlsPlayer
            onClick={togglePlay}
            src="https://customer-oh6t55xltlgrfayh.cloudflarestream.com/3c8ebd39be71d2451dee78d497b89a23/manifest/video.m3u8"
            autoPlay={false}
            controls={!isDesktop}
            playerRef={playerRef}
            className="w-full h-auto max-h-[65svh] sm:max-h-[70svh] lg:max-h-full mt-2 md:mt-8 bg-[#121212] max-w-[1280px] m-auto"
            loop
          />
        </div>
      </div>
    </div>
  );
}
