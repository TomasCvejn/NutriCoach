// The mark: a plate with one portion served (also reads as a target ring a quarter full).
export function Logo() {
  return (
    <span className="flex items-center gap-2 text-base font-semibold">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <circle cx="12" cy="12" r="10.5" className="fill-primary-track" />
        <path d="M12 12V3a9 9 0 0 1 9 9z" className="fill-primary" />
      </svg>
      NutriCoach
    </span>
  );
}
