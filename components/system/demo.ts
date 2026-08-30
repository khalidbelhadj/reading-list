import type React from "react";

// What every kit component ships next to itself as `<name>.demo.tsx`: the
// board renders `render()` under the component's title. Keep demos exhaustive
// (every variant, every size, every state), since the board is where a
// component is judged before it is used.
export type Demo = {
  title: string;
  description: string;
  render: () => React.ReactNode;
};
