import { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const updateCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
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
      {/* Main cursor dot */}
      <div
        className="fixed w-4 h-4 bg-primary rounded-full pointer-events-none z-[9999] mix-blend-difference transition-transform duration-150"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${isPointer ? 1.5 : 1})`,
        }}
      />
      
      {/* Cursor glow/trail */}
      <div
        className="fixed w-8 h-8 border-2 border-primary/50 rounded-full pointer-events-none z-[9998] transition-all duration-300 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${isPointer ? 1.8 : 1})`,
        }}
      />
      
      {/* Outer glow */}
      <div
        className="fixed w-12 h-12 bg-primary/10 rounded-full pointer-events-none z-[9997] blur-md transition-all duration-500 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${isPointer ? 2 : 1})`,
        }}
      />
    </>
  );
}
