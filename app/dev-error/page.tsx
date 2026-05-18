import { notFound } from "next/navigation";

const DevErrorPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  throw new Error("Synthetic error for previewing app/error.tsx");
};

export default DevErrorPage;
