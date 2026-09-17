"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  depth: number;
  phase: number;
  twinkle: number;
};

type Dust = { x: number; y: number; depth: number; alpha: number };

type StarfieldBackgroundProps = {
  className?: string;
  opacity?: number;
  minimal?: boolean;
};

const STAR_COUNT = 150;
const DUST_COUNT = 300;
const FRAME_INTERVAL = 1000 / 30;

function createStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, index) => {
    const depth = index < 55 ? 0.45 : index < 110 ? 0.72 : 1;
    return {
      x: Math.random(),
      y: Math.random(),
      radius: 0.35 + Math.random() * (depth * 1.15),
      alpha: 0.18 + Math.random() * (0.36 + depth * 0.2),
      depth,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.15 + Math.random() * 0.3,
    };
  });
}

function createDust(): Dust[] {
  return Array.from({ length: DUST_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    depth: 0.25 + Math.random() * 0.65,
    alpha: 0.08 + Math.random() * 0.2,
  }));
}

export default function StarfieldBackground({
  className = "",
  opacity = 1,
  minimal = false,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const drawingContext = canvasElement.getContext("2d");
    if (!drawingContext) return;
    const canvas = canvasElement;
    const context = drawingContext;

    const stars = createStars();
    const dust = createDust();
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastFrame = 0;
    let running = false;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(time: number) {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);

      const nebulae = [
        {
          x: 0.2 + Math.sin(time / 70000) * 0.04,
          y: 0.16 + Math.cos(time / 90000) * 0.03,
          radius: 0.7,
          color: "rgba(92, 45, 180, 0.3)",
        },
        {
          x: 0.82 + Math.cos(time / 85000) * 0.035,
          y: 0.42 + Math.sin(time / 65000) * 0.04,
          radius: 0.62,
          color: "rgba(24, 76, 170, 0.27)",
        },
        {
          x: 0.54 + Math.sin(time / 110000) * 0.03,
          y: 1.04 + Math.cos(time / 75000) * 0.035,
          radius: 0.58,
          color: "rgba(170, 42, 145, 0.25)",
        },
      ];
      for (const nebula of nebulae) {
        const gradient = context.createRadialGradient(
          width * nebula.x,
          height * nebula.y,
          0,
          width * nebula.x,
          height * nebula.y,
          Math.max(width, height) * nebula.radius,
        );
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      const seconds = time / 1000;
      for (const particle of dust) {
        const x =
          (((particle.x + seconds * 0.001 * particle.depth) % 1) + 1) % 1;
        context.globalAlpha = particle.alpha * opacity * (minimal ? 0.25 : 1);
        context.fillStyle = "#b8c9f5";
        context.fillRect(x * width, particle.y * height, 0.65, 0.65);
      }
      for (const star of stars) {
        const drift = (((seconds * 0.0024 * star.depth) % 1) + star.x) % 1;
        const x = drift * width;
        const y = star.y * height;
        const shimmer = reducedMotion
          ? 1
          : 1 + Math.sin(seconds * star.twinkle + star.phase) * 0.18;
        context.globalAlpha = Math.max(
          0,
          Math.min(1, star.alpha * shimmer * opacity * (minimal ? 0.32 : 1)),
        );
        context.fillStyle = star.depth > 0.8 ? "#f2f5ff" : "#b9c8f2";
        if (star.depth > 0.8 && !minimal) {
          context.shadowBlur = 5;
          context.shadowColor = "rgba(185, 207, 255, 0.75)";
        }
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
      if (!reducedMotion && !minimal && Math.floor(seconds / 10) % 2 === 0) {
        const progress = (seconds % 10) / 10;
        const x = width * (0.08 + progress * 0.55);
        const y = height * (0.18 + progress * 0.28);
        context.globalAlpha = Math.sin(progress * Math.PI) * 0.5 * opacity;
        context.strokeStyle = "#dbe8ff";
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - 38, y - 20);
        context.stroke();
      }
      context.globalAlpha = 1;
    }

    function frame(time: number) {
      if (!running) return;
      animationFrame = window.requestAnimationFrame(frame);
      if (time - lastFrame < FRAME_INTERVAL) return;
      lastFrame = time;
      draw(time);
    }

    function start() {
      if (running || document.hidden || reducedMotion) return;
      running = true;
      animationFrame = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(animationFrame);
    }

    function onVisibilityChange() {
      if (document.hidden) stop();
      else {
        draw(performance.now());
        start();
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!reducedMotion) start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [minimal, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
