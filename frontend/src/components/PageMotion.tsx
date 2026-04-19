import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";

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

export function PageMotion({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || reduceMotion) {
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sectionClass = `${className} w-full min-w-0`.trim();

  if (!mounted || reduceMotion) {
    return (
      <motion.div className={sectionClass} {...rest}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: "some", margin: "0px 0px -40px 0px" }}
      className={sectionClass}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || reduceMotion) {
    return <motion.div className={`${className} w-full min-w-0`.trim()}>{children}</motion.div>;
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
      viewport={{ once: true, amount: "some", margin: "0px 0px -48px 0px" }}
      variants={variants}
      className={`${className} w-full min-w-0`.trim()}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 32, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.65, ease: PREMIUM_EASE },
        },
      }}
      className={className}
    >
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
// animation. Preserves newlines so copy can be broken into stanzas.
export function AnimatedWords({
  text,
  className = "",
  wordClassName = "",
  initialDelay = 0.1,
  stagger = 0.05,
  as = "h1",
}: AnimatedWordsProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const Tag = motion[as] as typeof motion.h1;

  const lines = text.split("\n");

  if (!mounted || reduceMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  let wordIndex = 0;
  return (
    <Tag
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: initialDelay, staggerChildren: stagger } },
      }}
      aria-label={text}
    >
      {lines.map((line, lineIdx) => (
        <span
          key={`line-${lineIdx}`}
          style={{ display: "block", overflow: "hidden", lineHeight: "inherit" }}
        >
          {line.split(/(\s+)/).map((token) => {
            if (/^\s+$/.test(token)) {
              return (
                <span key={`sp-${wordIndex++}`} style={{ whiteSpace: "pre" }} aria-hidden="true">
                  {token}
                </span>
              );
            }
            return (
              <motion.span
                key={`w-${wordIndex++}`}
                className={wordClassName}
                style={{ display: "inline-block" }}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.55, ease: PREMIUM_EASE },
                  },
                }}
              >
                {token}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
