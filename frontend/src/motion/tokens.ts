import type { Transition, Variants } from 'motion/react';

export const easeOut = [0.16, 1, 0.3, 1] as const;

export const dur = {
  micro: 0.15,
  ui: 0.28,
  page: 0.36,
} as const;

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 34,
  mass: 0.85,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.75,
};

export const tweenUi: Transition = {
  duration: dur.ui,
  ease: easeOut,
};

export const tweenPage: Transition = {
  duration: dur.page,
  ease: easeOut,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: tweenPage,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: dur.micro, ease: easeOut },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: tweenUi,
  },
};
