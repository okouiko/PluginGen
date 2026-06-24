interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: RatingStarsProps) {
  const starSize = size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div className={`flex gap-0.5 ${starSize}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          } ${star <= value ? 'text-accent-amber' : 'text-hairline'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
