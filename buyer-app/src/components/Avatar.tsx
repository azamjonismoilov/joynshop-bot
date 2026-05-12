import { useState } from 'react';
import { cn } from '@/lib/cn';
import { colorFromName, getInitials } from '@/lib/format';

interface Props {
  name:       string;
  photoUrl?:  string | null;
  size?:      number;
  className?: string;
}

/**
 * Avatar — Telegram photo_url bo'lsa rasm, aks holda deterministik
 * pastel fon + initials. Image load xatosida initials fallback'ga
 * tushadi (silent).
 */
export function Avatar({ name, photoUrl, size = 48, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = photoUrl && !failed;
  const colors    = colorFromName(name);

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-display font-semibold shrink-0 select-none overflow-hidden',
        className,
      )}
      style={{
        width:           size,
        height:          size,
        borderRadius:    '50%',
        backgroundColor: showImage ? 'transparent' : colors.bg,
        color:           colors.fg,
        fontSize:        Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
