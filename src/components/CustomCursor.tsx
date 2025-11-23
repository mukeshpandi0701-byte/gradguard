import { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    let trailId = 0;

    const updateCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Add trail effect
      setTrail((prev) => {
        const newTrail = [...prev, { x: e.clientX, y: e.clientY, id: trailId++ }];
        return newTrail.slice(-12); // Keep last 12 trail points for smoother trail
      });
    };

    window.addEventListener("mousemove", updateCursor);

    // Clean up old trail points periodically
    const cleanupInterval = setInterval(() => {
      setTrail((prev) => prev.slice(-12));
    }, 50);

    return () => {
      window.removeEventListener("mousemove", updateCursor);
      clearInterval(cleanupInterval);
    };
  }, []);

  return (
    <>
      {/* Trail particles - small circles only */}
      {trail.map((point, index) => (
        <div
          key={point.id}
          className="fixed rounded-full pointer-events-none z-[9998]"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            width: `${4 + (index / trail.length) * 4}px`,
            height: `${4 + (index / trail.length) * 4}px`,
            transform: `translate(-50%, -50%)`,
            opacity: (index + 1) / trail.length * 0.7,
            background: `radial-gradient(circle, hsl(var(--primary-glow)) 0%, hsl(var(--primary)) 100%)`,
            boxShadow: `0 0 ${8 + (index / trail.length) * 8}px hsl(var(--primary-glow) / 0.6)`,
            transition: 'all 0.1s ease-out',
          }}
        />
      ))}
      
      {/* Main cursor - small bright dot */}
      <div
        className="fixed w-3 h-3 rounded-full pointer-events-none z-[9999] transition-all duration-100 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%)`,
          background: `radial-gradient(circle, #ffffff 0%, hsl(var(--primary-glow)) 100%)`,
          boxShadow: `0 0 15px hsl(var(--primary-glow)), 0 0 8px hsl(var(--primary))`,
        }}
      />
    </>
  );
}
