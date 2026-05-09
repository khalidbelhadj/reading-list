import React from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useInvalidateItems = () => {
  const queryClient = useQueryClient();
  return React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );
};
