export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Orb 1 - Large purple */}
      <div 
        className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(262 80% 60%) 0%, transparent 70%)',
          top: '10%',
          left: '10%',
          animationDuration: '20s',
          animationDelay: '0s',
        }}
      />
      
      {/* Orb 2 - Medium violet */}
      <div 
        className="absolute w-72 h-72 rounded-full opacity-15 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(280 75% 65%) 0%, transparent 70%)',
          top: '60%',
          right: '15%',
          animationDuration: '25s',
          animationDelay: '5s',
        }}
      />
      
      {/* Orb 3 - Small purple */}
      <div 
        className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(270 78% 68%) 0%, transparent 70%)',
          bottom: '15%',
          left: '20%',
          animationDuration: '30s',
          animationDelay: '10s',
        }}
      />
      
      {/* Orb 4 - Large light purple */}
      <div 
        className="absolute w-80 h-80 rounded-full opacity-12 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(265 72% 63%) 0%, transparent 70%)',
          top: '40%',
          right: '30%',
          animationDuration: '28s',
          animationDelay: '3s',
        }}
      />
      
      {/* Orb 5 - Medium violet */}
      <div 
        className="absolute w-56 h-56 rounded-full opacity-10 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(275 70% 62%) 0%, transparent 70%)',
          bottom: '30%',
          right: '10%',
          animationDuration: '22s',
          animationDelay: '7s',
        }}
      />
    </div>
  );
}
