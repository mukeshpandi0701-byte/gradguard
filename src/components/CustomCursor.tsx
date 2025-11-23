import { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    let trailId = 0;

    const updateCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Add trail effect
      setTrail((prev) => {
        const newTrail = [...prev, { x: e.clientX, y: e.clientY, id: trailId++ }];
        return newTrail.slice(-8); // Keep only last 8 trail points
      });
      
      const target = e.target as HTMLElement;
      setIsPointer(
        window.getComputedStyle(target).cursor === "pointer" ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") !== null ||
        target.closest("a") !== null
      );
    };

    window.addEventListener("mousemove", updateCursor);

    return () => {
      window.removeEventListener("mousemove", updateCursor);
    };
  }, []);

  return (
    <>
      {/* Trail particles */}
      {trail.map((point, index) => (
        <div
          key={point.id}
          className="fixed w-3 h-3 rounded-full pointer-events-none z-[9998] transition-all duration-500 ease-out"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            transform: `translate(-50%, -50%) scale(${(index + 1) / trail.length})`,
            opacity: (index + 1) / trail.length * 0.6,
            background: `radial-gradient(circle, hsl(var(--primary-glow)) 0%, hsl(var(--primary)) 50%, transparent 100%)`,
          }}
        />
      ))}
      
      {/* Main cursor with gradient ring */}
      <div
        className="fixed w-10 h-10 rounded-full pointer-events-none z-[9999] transition-all duration-200 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${isPointer ? 1.5 : 1})`,
          background: `radial-gradient(circle, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 40%, transparent 70%)`,
          boxShadow: `0 0 20px hsl(var(--primary-glow) / 0.8), 0 0 40px hsl(var(--primary) / 0.4)`,
        }}
      >
        {/* Inner bright dot */}
        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full"
          style={{
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px hsl(var(--primary-glow))',
          }}
        />
      </div>

      {/* Outer glow ring */}
      <div
        className="fixed w-16 h-16 rounded-full pointer-events-none z-[9997] transition-all duration-300 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${isPointer ? 1.8 : 1})`,
          background: `radial-gradient(circle, transparent 40%, hsl(var(--primary-glow) / 0.3) 50%, transparent 70%)`,
          border: `2px solid hsl(var(--primary) / 0.3)`,
          boxShadow: `0 0 30px hsl(var(--primary-glow) / 0.4)`,
        }}
      />
    </>
  );
}
