export function runSim(
  ms: number,
  onProgress: (p: number) => void,
  onDone: () => void
): () => void {
  const steps = 8;
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    onProgress(Math.min(100, Math.round((i / steps) * 100)));
    if (i >= steps) {
      window.clearInterval(timer);
      onDone();
    }
  }, ms / steps);
  return () => window.clearInterval(timer);
}