"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | null = null;

export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | null>(paddleInstance);

  useEffect(() => {
    if (paddleInstance) {
      setPaddle(paddleInstance);
      return;
    }

    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;

    initializePaddle({
      environment:
        (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") ??
        "sandbox",
      token,
    }).then((instance) => {
      if (instance) {
        paddleInstance = instance;
        setPaddle(instance);
      }
    });
  }, []);

  return paddle;
}
