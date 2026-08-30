import { Checkbox } from "./checkbox";
import { type Demo } from "./demo";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex h-row items-center gap-2.5 text-body">
    {children}
    {label}
  </label>
);

export const demo: Demo = {
  title: "Checkbox",
  description:
    "For choosing several of a set, or for a task list. A single yes/no setting is a Switch.",
  render: () => (
    <div className="flex max-w-sm flex-col">
      <Row label="Articles">
        <Checkbox defaultChecked />
      </Row>
      <Row label="Videos">
        <Checkbox />
      </Row>
      <Row label="Papers">
        <Checkbox indeterminate />
      </Row>
      <Row label="Archived">
        <Checkbox disabled />
      </Row>
    </div>
  ),
};
