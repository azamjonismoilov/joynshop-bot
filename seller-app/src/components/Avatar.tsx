import { colorFromName, getInitials } from '@/lib/format';

export interface AvatarProps {
  name:  string;
  size?: number;
}

export function Avatar({ name, size = 40 }: AvatarProps) {
  const colors   = colorFromName(name);
  const initials = getInitials(name);
  return (
    <div
      className="inline-flex items-center justify-center font-display font-semibold shrink-0 select-none"
      style={{
        width:           size,
        height:          size,
        borderRadius:    '50%',
        backgroundColor: colors.bg,
        color:           colors.fg,
        fontSize:        Math.round(size * 0.4),
      }}
    >
      {initials}
    </div>
  );
}
