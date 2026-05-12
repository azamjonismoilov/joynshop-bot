import { type ReactNode } from 'react';

interface Props {
  icon:        ReactNode;
  title:       string;
  description?: string;
  action?:     ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-bg-3 text-fg-3 mb-4">
          {icon}
        </div>
        <h2 className="font-display text-lg font-semibold text-fg-1 mb-1.5">{title}</h2>
        {description && (
          <p className="text-sm text-fg-3 font-body mb-5">{description}</p>
        )}
        {action}
      </div>
    </div>
  );
}
