"use client";

import { useEffect } from "react";

export function BootstrapJs() {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js");
  }, []);

  return null;
}