import { flushSync } from "react-dom";

type TransitionDirection = "forward" | "back";
type StartViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function navigateWithPageTransition(
  navigate: (path: string) => void,
  path: string,
  direction: TransitionDirection,
) {
  const transitionDocument = document as StartViewTransitionDocument;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = transitionDocument.startViewTransition;

  if (!startViewTransition || reduceMotion) {
    navigate(path);
    return;
  }

  document.documentElement.dataset.eventPageTransition = direction;
  const clearDirection = () => {
    delete document.documentElement.dataset.eventPageTransition;
  };

  try {
    const transition = startViewTransition.call(transitionDocument, () => {
      // Commit the routed React tree inside the browser's update callback so
      // it captures the old and new route states as one shared transition.
      flushSync(() => navigate(path));
    });
    void transition.finished.then(clearDirection, clearDirection);
  } catch {
    clearDirection();
    navigate(path);
  }
}
