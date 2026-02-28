"use client";

import { useEffect, useState } from "react";

interface UseIsMobileReturn {
  isMobile: boolean;
  isLoading: boolean;
}

const useIsMobile = (): UseIsMobileReturn => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
      setIsLoading(false);
    };

    checkIsMobile();

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => checkIsMobile();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return { isMobile, isLoading };
};

export default useIsMobile;
