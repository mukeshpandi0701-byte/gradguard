import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type AnimationStyle = "spinner" | "dots" | "bars" | "pulse" | "gradient";

interface PageTransitionLoaderProps {
  style?: AnimationStyle;
}

const SpinnerAnimation = () => (
  <div className="relative w-16 h-16">
    {/* Outer ring */}
    <motion.div
      className="absolute inset-0 rounded-full border-4 border-primary/20"
      style={{ borderTopColor: "hsl(var(--primary))", borderRightColor: "hsl(var(--primary))" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
    {/* Inner ring */}
    <motion.div
      className="absolute inset-2 rounded-full border-4 border-secondary/20"
      style={{ borderBottomColor: "hsl(var(--secondary))", borderLeftColor: "hsl(var(--secondary))" }}
      animate={{ rotate: -360 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
    />
    {/* Center dot */}
    <motion.div
      className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-gradient-to-br from-primary to-secondary"
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

const DotsAnimation = () => (
  <div className="flex items-center gap-2">
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-secondary"
        animate={{
          y: [-8, 8, -8],
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

const BarsAnimation = () => (
  <div className="flex items-end gap-1 h-12">
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        className="w-2 rounded-full bg-gradient-to-t from-primary to-secondary"
        animate={{
          height: ["16px", "48px", "16px"],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

const PulseAnimation = () => (
  <div className="relative w-20 h-20">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-primary"
        animate={{
          scale: [1, 2.5],
          opacity: [0.8, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: i * 0.5,
          ease: "easeOut",
        }}
      />
    ))}
    <motion.div
      className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary shadow-glow"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

const GradientAnimation = () => (
  <div className="relative w-20 h-20">
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background: "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--accent)), hsl(var(--primary)))",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
    />
    <div className="absolute inset-2 rounded-full bg-background" />
    <motion.div
      className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-gradient-to-br from-primary via-secondary to-accent"
      animate={{
        scale: [1, 1.3, 1],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

const animations: Record<AnimationStyle, React.FC> = {
  spinner: SpinnerAnimation,
  dots: DotsAnimation,
  bars: BarsAnimation,
  pulse: PulseAnimation,
  gradient: GradientAnimation,
};

export function PageTransitionLoader({ style = "gradient" }: PageTransitionLoaderProps) {
  const [currentStyle, setCurrentStyle] = useState<AnimationStyle>(style);
  const AnimationComponent = animations[currentStyle];

  // Randomly select animation style for variety
  useEffect(() => {
    const styles: AnimationStyle[] = ["spinner", "dots", "bars", "pulse", "gradient"];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    setCurrentStyle(randomStyle);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Glassmorphic background */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
      
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-primary/20 blur-3xl"
        animate={{
          x: [-50, 50, -50],
          y: [-30, 30, -30],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full bg-secondary/20 blur-3xl"
        animate={{
          x: [50, -50, 50],
          y: [30, -30, 30],
          scale: [1.2, 1, 1.2],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6">
        <AnimationComponent />
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-sm font-medium text-foreground/80">Loading</span>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="text-sm font-medium text-primary"
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              .
            </motion.span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Export individual animations for use elsewhere
export { SpinnerAnimation, DotsAnimation, BarsAnimation, PulseAnimation, GradientAnimation };
