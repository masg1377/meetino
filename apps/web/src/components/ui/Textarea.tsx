import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', invalid = false, rows = 4, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={[
          'block w-full rounded-xl border bg-white px-4 py-2.5 text-slate-900 shadow-sm',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2',
          'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
          invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-500 dark:focus:ring-rose-900/40'
            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100 dark:border-slate-700 dark:focus:border-brand-400 dark:focus:ring-brand-900/40',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500',
          className,
        ].join(' ')}
        {...rest}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
