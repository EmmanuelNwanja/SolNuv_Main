import { motion } from 'framer-motion';

const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      when: 'beforeChildren',
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

export function PageMotion({ children }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function MotionSection({ children, className = '' }) {
  return (
    <motion.div variants={sectionVariants} className={className}>
      {children}
    </motion.div>
  );
}
