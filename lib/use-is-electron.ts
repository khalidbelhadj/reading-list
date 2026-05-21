import { useEffect, useState } from "react";

export const useIsElectron = () => {
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    setIsElectron(
      typeof window !== "undefined" &&
        window.readingList?.platform === "electron",
    );
  }, []);
  return isElectron;
};
