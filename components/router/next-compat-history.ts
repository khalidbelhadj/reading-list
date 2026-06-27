import {
  createBrowserHistory,
  type RouterHistory,
} from "@tanstack/react-router";

// A browser history that coexists with Next.js's App Router.
//
// Both Next and TanStack monkeypatch window.history.pushState/replaceState.
// TanStack's patch treats *any* external call as a navigation and fires its
// subscribers (→ router reload → setState). Next calls replaceState during its
// own render commits, so the two patches feed each other an infinite loop at
// any non-root URL (the page never paints), plus a flood of
// "useInsertionEffect must not schedule updates" warnings.
//
// The patch is only there to detect *foreign* history mutations. TanStack's own
// push()/replace() notify the router directly, and back/forward still arrives
// via the popstate listener. So once the history is built we restore the
// pre-TanStack (Next-patched) methods: TanStack stops reacting to Next's
// internal replaceState calls, while genuine in-app navigation (all of which
// goes through router.navigate / <Link>) and browser back/forward keep working.
// Restoring Next's methods (rather than the raw natives) also keeps Next's
// usePathname/useSearchParams in sync for the root-layout watchers, and Next's
// pushState support updates that state without a server round-trip.
export const createNextCompatHistory = (): RouterHistory => {
  const nextPushState = window.history.pushState.bind(window.history);
  const nextReplaceState = window.history.replaceState.bind(window.history);

  const history = createBrowserHistory();

  window.history.pushState = nextPushState;
  window.history.replaceState = nextReplaceState;

  return history;
};
