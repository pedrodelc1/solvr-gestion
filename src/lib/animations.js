export const listItem = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: Math.min(i, 8) * 0.03, duration: 0.15 },
});
