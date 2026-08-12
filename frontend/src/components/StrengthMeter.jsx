function scorePassword(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 10) score += 1
  if (pw.length >= 16) score += 1
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1
  return Math.min(score, 5)
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
const COLORS = ['bg-line', 'bg-danger', 'bg-danger', 'bg-brass', 'bg-unlock', 'bg-unlock']

export default function StrengthMeter({ password }) {
  const score = scorePassword(password)
  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${i < score ? COLORS[score] : 'bg-line'}`}
          />
        ))}
      </div>
      <p className="text-xs text-steel mt-1 font-mono">{password ? LABELS[score] : 'Enter a master password'}</p>
    </div>
  )
}
