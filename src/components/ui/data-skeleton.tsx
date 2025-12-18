import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DataSkeletonProps {
  className?: string;
}

// Animated skeleton base component
const SkeletonPulse = ({ className }: DataSkeletonProps) => (
  <motion.div
    className={cn(
      "rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]",
      className
    )}
    animate={{
      backgroundPosition: ["200% 0", "-200% 0"],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: "linear",
    }}
  />
);

// Card skeleton for dashboard cards
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-24" />
        <SkeletonPulse className="h-8 w-8 rounded-lg" />
      </div>
      <SkeletonPulse className="h-8 w-20" />
      <SkeletonPulse className="h-3 w-32" />
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <SkeletonPulse className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Table skeleton with header and rows
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Table header */}
      <div className="bg-muted/30 p-4 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonPulse key={i} className="h-4 flex-1 max-w-[100px]" />
        ))}
      </div>
      {/* Table body */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Student card skeleton
export function StudentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-3 w-24" />
        </div>
        <SkeletonPulse className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <SkeletonPulse className="h-3 w-12" />
            <SkeletonPulse className="h-5 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-5 w-32" />
        <SkeletonPulse className="h-8 w-24 rounded-lg" />
      </div>
      <div style={{ height }} className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-3 w-6" />
          ))}
        </div>
        {/* Chart bars */}
        <div className="absolute left-12 right-0 bottom-8 top-4 flex items-end gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-gradient-to-t from-muted to-muted/30 rounded-t-md"
              initial={{ height: "20%" }}
              animate={{ height: `${30 + Math.random() * 50}%` }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
        {/* X-axis labels */}
        <div className="absolute left-12 right-0 bottom-0 flex justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-3 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
      <div className="flex items-center gap-4">
        <SkeletonPulse className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <SkeletonPulse className="h-6 w-40" />
          <SkeletonPulse className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// List skeleton
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card"
        >
          <SkeletonPulse className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="h-4 w-3/4" />
            <SkeletonPulse className="h-3 w-1/2" />
          </div>
          <SkeletonPulse className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Tab skeleton
export function TabsSkeleton({ tabs = 4 }: { tabs?: number }) {
  return (
    <div className="flex gap-2 border-b border-border/50 pb-2">
      {Array.from({ length: tabs }).map((_, i) => (
        <SkeletonPulse key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}

// Full page skeleton with header and content
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
        <SkeletonPulse className="h-10 w-32 rounded-md" />
      </div>
      {/* Tabs */}
      <TabsSkeleton />
      {/* Content */}
      <DashboardStatsSkeleton />
      {/* Table */}
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

// Export base skeleton for custom use
export { SkeletonPulse };
