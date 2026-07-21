/**
 * Dictabird mark — a cartoon prehistoric parrot (Flintstones-era vibe).
 * Sized via the outer container; keep viewBox fixed for crisp scaling.
 */
export function DictabirdLogo({
  className = "",
  title = "Dictabird",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Soft stone disc (optional fill when used alone on light bg) */}
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.08" />

      {/* Tail feathers — lagging behind, prehistoric plume */}
      <path
        d="M10 38c4-2 8-2 12 1-3 1-6 3-10 6-2-2-3-4-2-7Z"
        fill="#C45C26"
      />
      <path
        d="M12 42c5-1 9 0 12 3-4 1-7 2-11 3-2-1-2-4-1-6Z"
        fill="#E8A33D"
      />

      {/* Body — chunky cartoon torso */}
      <ellipse cx="30" cy="36" rx="14" ry="12" fill="#2F6F9F" />
      <ellipse cx="28" cy="38" rx="9" ry="7" fill="#3D8BC4" opacity="0.55" />

      {/* Wing fold */}
      <path
        d="M22 32c-4 4-5 10-2 14 6-2 10-6 12-11-3-1-6-2-10-3Z"
        fill="#1E4F75"
      />
      <path
        d="M24 36c-2 2-3 5-1 7 3-1 5-3 6-5-1.5-.5-3-1-5-2Z"
        fill="#E8A33D"
        opacity="0.85"
      />

      {/* Head */}
      <circle cx="40" cy="24" r="11" fill="#3D8BC4" />

      {/* Crest — spiky dino/parrot mohawk (the Flintstones cue) */}
      <path
        d="M34 16c1-6 4-10 7-12 0 4 0 7-1 10"
        fill="#C45C26"
      />
      <path
        d="M38 14c2-5 5-8 8-9-1 3-1 6-2 9"
        fill="#E8A33D"
      />
      <path
        d="M42 15c2-4 5-6 8-7-1 3-2 5-3 8"
        fill="#C45C26"
      />
      <path
        d="M45 17c1.5-3 4-5 6-5.5-.5 2.5-1.5 4-3 6"
        fill="#E8A33D"
      />

      {/* Cheek patch */}
      <ellipse cx="42" cy="27" rx="4" ry="3" fill="#F0C27A" opacity="0.9" />

      {/* Beak — big curved talker beak (dictation cue) */}
      <path
        d="M48 24c6 1 10 4 11 7-4 1-8 1-12 0 0-2 0-5 1-7Z"
        fill="#E8A33D"
      />
      <path
        d="M49 28c4 .5 7 1.5 9 3-3 .5-6 .5-9 0v-3Z"
        fill="#C45C26"
      />
      <path
        d="M50 25.5h3"
        stroke="#8B3A12"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Eye */}
      <circle cx="42" cy="22" r="3.2" fill="#F5F8FB" />
      <circle cx="43" cy="22.2" r="1.6" fill="#0B2545" />
      <circle cx="43.6" cy="21.6" r="0.5" fill="#F5F8FB" />

      {/* Tiny stone-age sparkle / dictation mark near beak */}
      <path
        d="M58 18l.6 1.4L60 20l-1.4.6L58 22l-.6-1.4L56 20l1.4-.6L58 18Z"
        fill="#E8A33D"
      />
    </svg>
  );
}

/** Compact mark for dark/colored badge backgrounds (no pale disc). */
export function DictabirdMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* Tail */}
      <path
        d="M10 38c4-2 8-2 12 1-3 1-6 3-10 6-2-2-3-4-2-7Z"
        fill="#F0C27A"
      />
      <path
        d="M12 42c5-1 9 0 12 3-4 1-7 2-11 3-2-1-2-4-1-6Z"
        fill="#E8A33D"
      />
      {/* Body */}
      <ellipse cx="30" cy="36" rx="14" ry="12" fill="#F5F8FB" opacity="0.95" />
      <path
        d="M22 32c-4 4-5 10-2 14 6-2 10-6 12-11-3-1-6-2-10-3Z"
        fill="#D6E6F2"
      />
      {/* Head */}
      <circle cx="40" cy="24" r="11" fill="#F5F8FB" />
      {/* Crest */}
      <path d="M34 16c1-6 4-10 7-12 0 4 0 7-1 10" fill="#E8A33D" />
      <path d="M38 14c2-5 5-8 8-9-1 3-1 6-2 9" fill="#F0C27A" />
      <path d="M42 15c2-4 5-6 8-7-1 3-2 5-3 8" fill="#E8A33D" />
      {/* Beak */}
      <path
        d="M48 24c6 1 10 4 11 7-4 1-8 1-12 0 0-2 0-5 1-7Z"
        fill="#E8A33D"
      />
      <path
        d="M49 28c4 .5 7 1.5 9 3-3 .5-6 .5-9 0v-3Z"
        fill="#C45C26"
      />
      {/* Eye */}
      <circle cx="42" cy="22" r="3" fill="#0B2545" />
      <circle cx="43.2" cy="21.4" r="0.7" fill="#F5F8FB" />
      {/* Sparkle */}
      <path
        d="M58 18l.6 1.4L60 20l-1.4.6L58 22l-.6-1.4L56 20l1.4-.6L58 18Z"
        fill="#E8A33D"
      />
    </svg>
  );
}
