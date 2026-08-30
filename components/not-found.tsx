import { Link } from "@tanstack/react-router";

import { Button } from "@/components/system/button";
import { NonIdealState } from "@/components/system/non-ideal-state";

// The standalone 404 page (the old Next.js app/not-found.tsx design). Shown
// when a route throws notFound() — e.g. the dev-gated /debug pages in
// production. Arbitrary unknown URLs render the in-app SecondaryPage 404
// from the root route instead, matching the old SPA behavior.
export const NotFound = () => {
  return (
    <NonIdealState
      fullPage
      titleAs="h1"
      title="Page not found"
      description="We couldn't find what you were looking for. It may have been moved or never existed."
      actions={
        <Button variant="primary" nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
      }
    />
  );
};
