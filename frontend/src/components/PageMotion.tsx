import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ComponentProps, ReactNode } from "react";

// Premium easing curve — matches Privado / Linear / Arc style: gentle accel,
// soft settle. Avoids the "pop" feel of default springs.
const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: PREMIUM_EASE,
      when: "beforeChildren" as const,
      staggerChildren: 0.05,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: PREMIUM_EASE },
  },
};

const staggerVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: PREMIUM_EASE,
      staggerChildren: 0.09,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.65, ease: PREMIUM_EASE },
  },
};

function debugAnimLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  fetch("http://127.0.0.1:7567/ingest/e8cc33b1-e17f-4a70-9052-be1634f820ff", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "fbdde2",
    },
    body: JSON.stringify({
      sessionId: "fbdde2",
      runId: "pre-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

// NOTE: the previous implementation used a `mounted` flag that rendered a
// non-animated wrapper on the first render and only applied `initial="hidden"`
// on re-render. That prevented animations from ever firing because
// framer-motion's `initial` only runs once (on first mount). We now render
// the motion wrapper immediately and rely on `useReducedMotion` to opt out.

export function PageMotion({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="w-full min-w-0">{children}</div>;
  }

  return (
    <motion.div
      className="w-full min-w-0"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
} & Omit<
  ComponentProps<typeof motion.div>,
  "children" | "className" | "variants" | "initial" | "whileInView" | "viewport"
>;

export function MotionSection({ children, className = "", ...rest }: MotionSectionProps) {
  const reduceMotion = useReducedMotion();
  const sectionLogIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const sectionClass = `${className} w-full min-w-0`.trim();
  const {
    onViewportEnter: originalOnViewportEnter,
    onViewportLeave: originalOnViewportLeave,
    ...restProps
  } = rest;

  useEffect(() => {
    // #region agent log
    debugAnimLog("H1", "PageMotion.tsx:MotionSection", "MotionSection mounted", {
      sectionId: sectionLogIdRef.current,
      reduceMotion,
      hasOriginalEnterHandler: typeof originalOnViewportEnter === "function",
      hasOriginalLeaveHandler: typeof originalOnViewportLeave === "function",
      className: sectionClass.slice(0, 120),
      viewportOnce: true,
    });
    // #endregion
  }, [originalOnViewportEnter, originalOnViewportLeave, reduceMotion, sectionClass]);

  if (reduceMotion) {
    // #region agent log
    debugAnimLog("H2", "PageMotion.tsx:MotionSection", "reduceMotion branch rendered", {
      sectionId: sectionLogIdRef.current,
      className: sectionClass.slice(0, 120),
    });
    // #endregion
    // Reuse motion.div so the rest props (onMouseMove, etc. — whose handler
    // signatures differ between HTMLAttributes and motion) remain type-compatible.
    return (
      <motion.div className={sectionClass} {...restProps}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -80px 0px" }}
      onViewportEnter={(...args) => {
        // #region agent log
        debugAnimLog("H3", "PageMotion.tsx:MotionSection", "viewport enter", {
          sectionId: sectionLogIdRef.current,
          className: sectionClass.slice(0, 120),
        });
        // #endregion
        if (typeof originalOnViewportEnter === "function") {
          originalOnViewportEnter(...args);
        }
      }}
      onViewportLeave={(...args) => {
        // #region agent log
        debugAnimLog("H3", "PageMotion.tsx:MotionSection", "viewport leave", {
          sectionId: sectionLogIdRef.current,
          className: sectionClass.slice(0, 120),
        });
        // #endregion
        if (typeof originalOnViewportLeave === "function") {
          originalOnViewportLeave(...args);
        }
      }}
      className={sectionClass}
      {...restProps}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const staggerLogIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const rootClass = `${className} w-full min-w-0`.trim();

  useEffect(() => {
    // #region agent log
    debugAnimLog("H1", "PageMotion.tsx:MotionStagger", "MotionStagger mounted", {
      staggerId: staggerLogIdRef.current,
      reduceMotion,
      delay,
      viewportOnce: true,
      className: rootClass.slice(0, 120),
    });
    // #endregion
  }, [delay, reduceMotion, rootClass]);

  if (reduceMotion) {
    // #region agent log
    debugAnimLog("H2", "PageMotion.tsx:MotionStagger", "reduceMotion branch rendered", {
      staggerId: staggerLogIdRef.current,
      className: rootClass.slice(0, 120),
    });
    // #endregion
    return <div className={rootClass}>{children}</div>;
  }

  const variants = {
    hidden: staggerVariants.hidden,
    visible: {
      ...staggerVariants.visible,
      transition: {
        ...staggerVariants.visible.transition,
        delay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -80px 0px" }}
      onViewportEnter={() => {
        // #region agent log
        debugAnimLog("H3", "PageMotion.tsx:MotionStagger", "viewport enter", {
          staggerId: staggerLogIdRef.current,
          className: rootClass.slice(0, 120),
        });
        // #endregion
      }}
      onViewportLeave={() => {
        // #region agent log
        debugAnimLog("H3", "PageMotion.tsx:MotionStagger", "viewport leave", {
          staggerId: staggerLogIdRef.current,
          className: rootClass.slice(0, 120),
        });
        // #endregion
      }}
      variants={variants}
      className={rootClass}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

type AnimatedWordsProps = {
  text: string;
  className?: string;
  wordClassName?: string;
  initialDelay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
};

// Word-by-word staggered reveal — Privado.ai / Invisible.ai-style headline
// animation. Uses a pure CSS keyframe (`solnuv-word-reveal`, defined in
// globals.css) instead of framer-motion so the animation plays even if
// JS hydration is delayed, fails, or a stale service worker serves an
// older bundle. Preserves newlines so copy can be broken into stanzas.
export function AnimatedWords({
  text,
  className = "",
  wordClassName = "",
  initialDelay = 0.1,
  stagger = 0.05,
  as = "h1",
}: AnimatedWordsProps) {
  const Tag = as as keyof JSX.IntrinsicElements;
  const lines = text.split("\n");

  let wordIndex = 0;
  return (
    <Tag className={className} aria-label={text}>
      {lines.map((line, lineIdx) => (
        <span
          key={`line-${lineIdx}`}
          style={{ display: "block", overflow: "hidden", lineHeight: "inherit" }}
        >
          {line.split(/(\s+)/).map((token) => {
            if (/^\s+$/.test(token)) {
              return (
                <span
                  key={`sp-${wordIndex++}`}
                  style={{ whiteSpace: "pre" }}
                  aria-hidden="true"
                >
                  {token}
                </span>
              );
            }
            const delay = initialDelay + wordIndex * stagger;
            const key = `w-${wordIndex++}`;
            return (
              <span
                key={key}
                className={`anim-word ${wordClassName}`.trim()}
                style={{ animationDelay: `${delay}s` }}
              >
                {token}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
