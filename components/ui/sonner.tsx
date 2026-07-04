import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  IconCircleCheckFilled,
  IconInfoCircleFilled,
  IconAlertTriangleFilled,
  IconLoader2,
} from "@tabler/icons-react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <IconCircleCheckFilled className="size-4" />,
        info: <IconInfoCircleFilled className="size-4" />,
        warning: <IconAlertTriangleFilled className="size-4" />,
        // Error toasts intentionally render no icon — they communicate
        // severity through destructive text color (see toastOptions below)
        // instead of taking up space with an icon. `null` skips both the icon
        // and the layout slot it would have reserved.
        error: null,
        loading: <IconLoader2 className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast group/toast data-[type=error]:!text-destructive",
          description: "group-data-[type=error]/toast:!text-destructive/70",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
