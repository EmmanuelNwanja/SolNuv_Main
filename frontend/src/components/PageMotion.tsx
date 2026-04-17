import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";

const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren" as const,
      staggerChildren: 0.06,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export function PageMotion({ children }: { children: ReactNode }) {
  useReducedMotion();
  return (
    <motion.div
      variants={pageVariants}
      initial={false}
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
  useReducedMotion();
  return (
    <motion.div
      variants={sectionVariants}
      initial={false}
      animate="visible"
      className={className}
      {...rest}
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
  useReducedMotion();
  return (
    <motion.div
      initial={false}
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            delay,
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
            staggerChildren: 0.07,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
