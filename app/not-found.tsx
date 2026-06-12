import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ElectronDragRegion } from "@/components/electron-drag-region";

const NotFound = () => {
  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <ElectronDragRegion />
      <div className="flex flex-col items-start gap-4 max-w-md w-full">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find what you were looking for. It may have been
            moved or never existed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
