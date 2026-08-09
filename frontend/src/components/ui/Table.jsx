import cn from '../../lib/cn';

/**
 * Table primitives.
 *
 * Administrative screens compare rows against each other — version to version,
 * status to status — and that is what a table is for. Cards are for browsing;
 * tables are for managing.
 *
 * The scroll container is focusable so a keyboard user can actually reach the
 * columns that overflow on a narrow screen, which is the usual accessibility
 * failure of a "just let it scroll horizontally" table.
 */
export function TableWrap({ className, children, label }) {
  return (
    <div
      className={cn('overflow-x-auto rounded-xl border border-line bg-panel shadow-e1', className)}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function Table({ className, children, ...rest }) {
  return (
    <table className={cn('w-full border-collapse text-sm', className)} {...rest}>
      {children}
    </table>
  );
}

export function THead({ className, children }) {
  return (
    <thead
      className={cn(
        'border-b border-line bg-ink/40 text-left text-2xs font-semibold uppercase tracking-wider text-fg-faint',
        className
      )}
    >
      {children}
    </thead>
  );
}

export function TH({ className, align = 'left', children, ...rest }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-2.5 font-semibold',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ className, children }) {
  return <tbody className={cn('divide-y divide-line', className)}>{children}</tbody>;
}

export function TR({ className, interactive = false, children, ...rest }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        interactive && 'hover:bg-raised/50',
        className
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({ className, align = 'left', children, ...rest }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export default Table;
