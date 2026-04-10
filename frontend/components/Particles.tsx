"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

export function Particles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = [
      "rgba(26, 200, 176, 0.3)",
      "rgba(214, 75, 138, 0.2)",
      "rgba(123, 47, 190, 0.2)",
    ];

    const p: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(p);
  }, []);

  return (
    <div className="particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
