import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NonIdealState } from "@/components/ui/non-ideal-state";

const NotFound = () => {
  return (
    <NonIdealState
      fullPage
      titleAs="h1"
      title="Page not found"
      description="We couldn't find what you were looking for. It may have been moved or never existed."
      actions={
        <Button nativeButton={false} render={<Link href="/" />}>
          Go home
        </Button>
      }
    />
  );
};

export default NotFound;
