import React from "react";

/**
 * A contiguous run of keyboard-navigable item rows (one list, one group, the
 * pinned section, …). Sections announce themselves to the registry so the
 * cursor owner can walk every row top-to-bottom without knowing which sections
 * exist — that decoupling is what lets item groups be placed anywhere.
 */
export type NavSection = {
  // The section's container element, used to order sections by vertical
  // position (so the order follows the actual on-screen layout).
  getElement: () => HTMLElement | null;
  // All navigable ids in this section, in order — including ones scrolled out
  // of a virtualized window (nav needs the full order; `scrollToId` reveals
  // off-screen rows on demand).
  getIds: () => string[];
  // Scroll `id` into view. Returns true if this section owns `id` (and handled
  // it), false otherwise, so the registry can try the next section.
  scrollToId: (id: string) => boolean;
};

export type NavRegistry = {
  register: (key: string, section: NavSection) => void;
  unregister: (key: string) => void;
  getOrderedIds: () => string[];
  scrollToId: (id: string) => void;
};

const NavRegistryContext = React.createContext<NavRegistry | null>(null);

const createNavRegistry = (): NavRegistry => {
  const sections = new Map<string, NavSection>();

  // Sections sorted by their container's vertical position. Recomputed per call
  // (cheap — there are only a handful) so the order tracks collapses, reorders,
  // and arbitrary placement without bookkeeping.
  const orderedSections = () =>
    [...sections.values()]
      .map((section) => ({ section, element: section.getElement() }))
      .filter(
        (entry): entry is { section: NavSection; element: HTMLElement } =>
          entry.element !== null,
      )
      .sort(
        (a, b) =>
          a.element.getBoundingClientRect().top -
          b.element.getBoundingClientRect().top,
      )
      .map((entry) => entry.section);

  return {
    register: (key, section) => {
      sections.set(key, section);
    },
    unregister: (key) => {
      sections.delete(key);
    },
    getOrderedIds: () =>
      orderedSections().flatMap((section) => section.getIds()),
    scrollToId: (id) => {
      for (const section of orderedSections()) {
        if (section.scrollToId(id)) return;
      }
    },
  };
};

/** Creates a stable registry instance. Call once in the cursor owner. */
export const useNavRegistry = (): NavRegistry => {
  const ref = React.useRef<NavRegistry | null>(null);
  if (!ref.current) ref.current = createNavRegistry();
  return ref.current;
};

export const NavRegistryProvider = ({
  registry,
  children,
}: {
  registry: NavRegistry;
  children: React.ReactNode;
}) => (
  <NavRegistryContext.Provider value={registry}>
    {children}
  </NavRegistryContext.Provider>
);

/**
 * Registers a navigable section with the nearest registry for the lifetime of
 * the calling component. The latest closures are read through a ref so changing
 * data (item ids, etc.) never re-registers.
 */
export const useNavSection = (section: NavSection) => {
  const registry = React.useContext(NavRegistryContext);
  const sectionRef = React.useRef(section);
  sectionRef.current = section;
  const key = React.useId();

  React.useEffect(() => {
    if (!registry) return;
    registry.register(key, {
      getElement: () => sectionRef.current.getElement(),
      getIds: () => sectionRef.current.getIds(),
      scrollToId: (id) => sectionRef.current.scrollToId(id),
    });
    return () => registry.unregister(key);
  }, [registry, key]);
};

/**
 * Scrolls `el` into view within `container`, keeping a few rows of lookahead
 * margin. Shared by every nav section so keyboard scrolling feels identical
 * whether a row is virtualized or not.
 */
export const scrollIntoViewWithMargin = (
  container: HTMLElement,
  el: HTMLElement,
) => {
  const rect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const margin = rect.height * 3;
  if (rect.top - margin < containerRect.top) {
    container.scrollBy({ top: rect.top - containerRect.top - margin });
  } else if (rect.bottom + margin > containerRect.bottom) {
    container.scrollBy({ top: rect.bottom - containerRect.bottom + margin });
  }
};
