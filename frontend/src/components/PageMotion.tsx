import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
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
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.07,
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
