import { motion } from "framer-motion";

export function PageTransitionLoader() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer spinning ring */}
          <motion.div
            className="w-12 h-12 rounded-full border-4 border-primary/20"
            style={{ borderTopColor: "hsl(var(--primary))" }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          {/* Inner pulsing dot */}
          <motion.div
            className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-primary"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <motion.p
          className="text-sm text-muted-foreground font-medium"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Loading...
        </motion.p>
      </div>
    </motion.div>
  );
}
