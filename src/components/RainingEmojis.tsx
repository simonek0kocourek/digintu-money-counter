import { useEffect, useState } from 'react';

interface EmojiItem {
  id: number;
  emoji: string;
  left: number; // horizontal percentage (0 - 100)
  size: number; // size in pixels
  duration: number; // fall duration in seconds
  delay: number; // start delay in seconds
  spinDir: number; // spin direction (1 or -1)
}

const EMOJI_POOL = ['💸', '💵', '💰', '🪙', '🤑'];

export default function RainingEmojis({ active }: { active: boolean }) {
  const [emojis, setEmojis] = useState<EmojiItem[]>([]);

  useEffect(() => {
    if (!active) {
      setEmojis([]);
      return;
    }

    let idCounter = 0;

    const spawnEmoji = () => {
      const newEmoji: EmojiItem = {
        id: idCounter++,
        emoji: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)],
        left: Math.random() * 100,
        size: Math.floor(Math.random() * 24) + 16, // Random size from 16px to 40px
        duration: Math.random() * 6 + 6, // Random speed (6s to 12s to feel slow and luxury)
        delay: Math.random() * 0.5,
        spinDir: Math.random() > 0.5 ? 1 : -1,
      };

      setEmojis((prev) => {
        // Keep the active list capped at 50 to maintain solid 60fps performance
        const truncated = prev.length > 50 ? prev.slice(prev.length - 50) : prev;
        return [...truncated, newEmoji];
      });
    };

    // Spawn an emoji every 350ms
    const interval = setInterval(spawnEmoji, 350);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
      {emojis.map((item) => (
        <span
          key={item.id}
          className="absolute select-none animate-emoji-fall opacity-80"
          style={{
            left: `${item.left}%`,
            fontSize: `${item.size}px`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
            top: '-50px',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
            // Set css custom property for spin direction
            ['--spin-dir' as string]: item.spinDir,
          } as React.CSSProperties}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}
