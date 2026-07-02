"use client";

import { useEffect } from "react";

type HeaderStyles = {
  position: string;
  transform: string;
  top: string;
  translate: string;
  willChange: string;
};

type AncestorSnapshot = {
  tag: string;
  id: string;
  className: string;
  transform: string;
  perspective: string;
  filter: string;
  contain: string;
  overflow: string;
};

type ScrollSnapshot = {
  scrollY: number;
  headerTop: number;
  headerHeight: number;
  mainTop: number | null;
  docScrollTop: number;
  bodyScrollTop: number;
  visualViewportOffsetTop: number | null;
  visualViewportHeight: number | null;
  headerStyles: HeaderStyles;
  ancestors: AncestorSnapshot[];
};

const ANCESTOR_PROPS = ["transform", "perspective", "filter", "contain", "overflow"] as const;
const LOG_PREFIX = "[LayoutScrollDiagnostics]";

function isDevEnvironment() {
  return process.env.NODE_ENV === "development";
}

function readHeaderStyles(header: HTMLElement): HeaderStyles {
  const styles = getComputedStyle(header);
  return {
    position: styles.position,
    transform: styles.transform,
    top: styles.top,
    translate: styles.translate,
    willChange: styles.willChange,
  };
}

function readAncestorSnapshots(header: HTMLElement): AncestorSnapshot[] {
  const snapshots: AncestorSnapshot[] = [];
  let node: HTMLElement | null = header.parentElement;

  while (node && node !== document.documentElement) {
    const styles = getComputedStyle(node);
    const snapshot: AncestorSnapshot = {
      tag: node.tagName.toLowerCase(),
      id: node.id,
      className: node.className,
      transform: styles.transform,
      perspective: styles.perspective,
      filter: styles.filter,
      contain: styles.contain,
      overflow: styles.overflow,
    };

    const hasInterestingAncestor =
      snapshot.transform !== "none" ||
      snapshot.perspective !== "none" ||
      snapshot.filter !== "none" ||
      snapshot.contain !== "none" ||
      snapshot.overflow !== "visible";

    if (hasInterestingAncestor) {
      snapshots.push(snapshot);
    }

    node = node.parentElement;
  }

  return snapshots;
}

function captureSnapshot(header: HTMLElement, main: HTMLElement | null): ScrollSnapshot {
  const headerRect = header.getBoundingClientRect();
  const mainRect = main?.getBoundingClientRect();

  return {
    scrollY: window.scrollY,
    headerTop: headerRect.top,
    headerHeight: headerRect.height,
    mainTop: mainRect?.top ?? null,
    docScrollTop: document.documentElement.scrollTop,
    bodyScrollTop: document.body.scrollTop,
    visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
    visualViewportHeight: window.visualViewport?.height ?? null,
    headerStyles: readHeaderStyles(header),
    ancestors: readAncestorSnapshots(header),
  };
}

function snapshotChanged(previous: ScrollSnapshot | null, next: ScrollSnapshot) {
  if (!previous) return true;

  return (
    previous.scrollY !== next.scrollY ||
    previous.headerTop !== next.headerTop ||
    previous.headerHeight !== next.headerHeight ||
    previous.mainTop !== next.mainTop ||
    previous.docScrollTop !== next.docScrollTop ||
    previous.bodyScrollTop !== next.bodyScrollTop ||
    previous.visualViewportOffsetTop !== next.visualViewportOffsetTop ||
    previous.visualViewportHeight !== next.visualViewportHeight ||
    JSON.stringify(previous.headerStyles) !== JSON.stringify(next.headerStyles) ||
    JSON.stringify(previous.ancestors) !== JSON.stringify(next.ancestors)
  );
}

function logSnapshot(source: string, snapshot: ScrollSnapshot, previous: ScrollSnapshot | null) {
  const changed = snapshotChanged(previous, snapshot);
  const label = changed ? `${LOG_PREFIX} ${source}` : `${LOG_PREFIX} ${source} (unchanged metrics)`;

  console.groupCollapsed(label);
  console.log("window.scrollY", snapshot.scrollY);
  console.log("header.getBoundingClientRect().top", snapshot.headerTop);
  console.log("header.getBoundingClientRect().height", snapshot.headerHeight);
  console.log("main.getBoundingClientRect().top", snapshot.mainTop);
  console.log("document.documentElement.scrollTop", snapshot.docScrollTop);
  console.log("document.body.scrollTop", snapshot.bodyScrollTop);
  console.log("visualViewport?.offsetTop", snapshot.visualViewportOffsetTop);
  console.log("visualViewport?.height", snapshot.visualViewportHeight);
  console.log("header computed styles", snapshot.headerStyles);

  if (snapshot.ancestors.length > 0) {
    console.log("header ancestors with transform/perspective/filter/contain/overflow", snapshot.ancestors);
  } else {
    console.log("header ancestors with transform/perspective/filter/contain/overflow", "none");
  }

  if (previous && changed) {
    const deltas: Record<string, unknown> = {};
    if (previous.headerTop !== snapshot.headerTop) deltas.headerTop = { from: previous.headerTop, to: snapshot.headerTop };
    if (previous.headerHeight !== snapshot.headerHeight) {
      deltas.headerHeight = { from: previous.headerHeight, to: snapshot.headerHeight };
    }
    if (previous.mainTop !== snapshot.mainTop) deltas.mainTop = { from: previous.mainTop, to: snapshot.mainTop };
    if (previous.visualViewportOffsetTop !== snapshot.visualViewportOffsetTop) {
      deltas.visualViewportOffsetTop = { from: previous.visualViewportOffsetTop, to: snapshot.visualViewportOffsetTop };
    }
    if (previous.visualViewportHeight !== snapshot.visualViewportHeight) {
      deltas.visualViewportHeight = { from: previous.visualViewportHeight, to: snapshot.visualViewportHeight };
    }
    if (JSON.stringify(previous.headerStyles) !== JSON.stringify(snapshot.headerStyles)) {
      deltas.headerStyles = { from: previous.headerStyles, to: snapshot.headerStyles };
    }
    if (JSON.stringify(previous.ancestors) !== JSON.stringify(snapshot.ancestors)) {
      deltas.ancestors = { from: previous.ancestors, to: snapshot.ancestors };
    }
    console.log("deltas", deltas);
  }

  console.groupEnd();
}

export function LayoutScrollDiagnostics() {
  useEffect(() => {
    if (!isDevEnvironment()) {
      return;
    }

    let previous: ScrollSnapshot | null = null;
    let frame = 0;

    const sample = (source: string) => {
      const header = document.querySelector("header");
      if (!(header instanceof HTMLElement)) {
        console.warn(`${LOG_PREFIX} header element not found during ${source}`);
        return;
      }

      const main = document.querySelector("main");
      const snapshot = captureSnapshot(header, main instanceof HTMLElement ? main : null);
      logSnapshot(source, snapshot, previous);
      previous = snapshot;
    };

    const onScroll = () => {
      const currentFrame = ++frame;
      window.requestAnimationFrame(() => {
        if (currentFrame !== frame) return;
        sample("scroll");
      });
    };

    const onVisualViewportChange = () => {
      sample("visualViewport");
    };

    console.info(`${LOG_PREFIX} enabled — scroll and visualViewport events will be logged.`);
    sample("mount");

    window.addEventListener("scroll", onScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", onVisualViewportChange);
    window.visualViewport?.addEventListener("resize", onVisualViewportChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("scroll", onVisualViewportChange);
      window.visualViewport?.removeEventListener("resize", onVisualViewportChange);
      console.info(`${LOG_PREFIX} disabled.`);
    };
  }, []);

  return null;
}
