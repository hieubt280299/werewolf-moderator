import type { Transition, Variants } from 'framer-motion';

/**
 * Stepped easing: quantises progress into `frames` discrete jumps so motion reads
 * like a hand-drawn flip-book instead of a smooth tween.
 */
export const stepEase =
  (frames: number) =>
  (t: number): number =>
    t >= 1 ? 1 : Math.floor(t * frames) / frames;

export const stepped = (frames = 4, duration = 0.32): Transition => ({
  duration,
  ease: stepEase(frames),
});

export const fadeStep: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: stepped(4) },
  exit: { opacity: 0, y: -8, transition: stepped(3, 0.2) },
};

export const cardDeal: Variants = {
  hidden: { opacity: 0, rotateY: 90, scale: 0.9 },
  show: (i: number = 0) => ({
    opacity: 1,
    rotateY: 0,
    scale: 1,
    transition: { ...stepped(5, 0.4), delay: i * 0.04 },
  }),
};

export const sheet: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: stepped(6, 0.3) },
  exit: { y: '100%', transition: stepped(4, 0.22) },
};

export const stagger: Variants = {
  show: { transition: { staggerChildren: 0.05 } },
};
