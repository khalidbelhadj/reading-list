import Link from "next/link";

const pages = [
  { href: "/debug/code-block", title: "Code block language picker" },
  { href: "/debug/design-system", title: "Design system" },
  { href: "/debug/kbd", title: "Kbd styles" },
  { href: "/debug/review-count-animations", title: "Review count animations" },
  { href: "/debug/review-dialogs", title: "Review dialogs" },
  { href: "/debug/review-summary-preview", title: "Review summary preview" },
  { href: "/debug/spinners", title: "Spinners" },
  { href: "/debug/toasts", title: "Toasts" },
];

const DebugIndexPage = () => {
  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="flex flex-col items-start gap-4 max-w-md w-full">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Debug</h1>
          <p className="text-sm text-muted-foreground">
            Standalone previews and visual sandboxes.
          </p>
        </div>
        <ul className="flex flex-col gap-1 w-full">
          {pages.map(({ href, title }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-baseline justify-between gap-4 py-1 text-sm hover:text-foreground text-muted-foreground"
              >
                <span className="text-foreground">{title}</span>
                <span className="font-mono text-xs">{href}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DebugIndexPage;
