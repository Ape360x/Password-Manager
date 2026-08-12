export default function Dial({ size = 40, unlocked = false, spinning = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" stroke="#2A3141" strokeWidth="3" />
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="#C9A227"
        strokeWidth="3"
        strokeDasharray="8 10"
        style={{
          transformOrigin: '50px 50px',
          transition: 'transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: `rotate(${unlocked ? 220 : 0}deg)`,
          animation: spinning ? 'dial-spin 0.9s linear infinite' : 'none',
        }}
      />
      {/* tick marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 2 * Math.PI
        const x1 = 50 + 38 * Math.cos(angle)
        const y1 = 50 + 38 * Math.sin(angle)
        const x2 = 50 + 43 * Math.cos(angle)
        const y2 = 50 + 43 * Math.sin(angle)
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3A4356" strokeWidth="2" />
        )
      })}
      {/* indicator / pointer */}
      <g
        style={{
          transformOrigin: '50px 50px',
          transition: 'transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: `rotate(${unlocked ? 220 : 0}deg)`,
          animation: spinning ? 'dial-spin 0.9s linear infinite' : 'none',
        }}
      >
        <line x1="50" y1="50" x2="50" y2="16" stroke={unlocked ? '#4FA98C' : '#E0BC4E'} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="8" fill={unlocked ? '#4FA98C' : '#C9A227'} />
      <style>{`
        @keyframes dial-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}
