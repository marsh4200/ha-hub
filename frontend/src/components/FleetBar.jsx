import { num } from '../lib/format';

/**
 * One bar for the whole fleet. Proportion beats four identical stat boxes —
 * you read "mostly green with a red sliver" before you read any number.
 */
export default function FleetBar({ stats, attention, filter, onFilter }) {
  const total = stats.total || 0;
  const segments = [
    { key: 'online',  label: 'Live',     value: stats.online  || 0, color: '#22C55E' },
    { key: 'offline', label: 'Offline',  value: stats.offline || 0, color: '#FB7185' },
    { key: 'unknown', label: 'Unchecked',value: stats.unknown || 0, color: '#475569' },
  ];

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-semibold tnum leading-none">{num(total)}</span>
          <span className="eyebrow">{total === 1 ? 'site' : 'sites'}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {stats.linked > 0 && (
            <span className="tnum">
              <span className="text-slate-200 font-medium">{num(stats.linked)}</span> linked
            </span>
          )}
          {attention > 0 && (
            <span className="tnum text-warn">
              <span className="font-medium">{num(attention)}</span> need attention
            </span>
          )}
        </div>
      </div>

      {total > 0 ? (
        <div className="flex h-2 rounded-full overflow-hidden bg-bg gap-px">
          {segments.filter(s => s.value > 0).map(s => (
            <div
              key={s.key}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${s.value}`}
              className="transition-all duration-500"
            />
          ))}
        </div>
      ) : (
        <div className="h-2 rounded-full bg-bg" />
      )}

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <FilterPill active={filter === 'all'} onClick={() => onFilter('all')} label="All" count={total} />
        {segments.map(s => (
          <FilterPill
            key={s.key}
            active={filter === s.key}
            onClick={() => onFilter(s.key)}
            label={s.label}
            count={s.value}
            color={s.color}
          />
        ))}
        <FilterPill
          active={filter === 'attention'}
          onClick={() => onFilter('attention')}
          label="Needs attention"
          count={attention}
          color="#FBBF24"
        />
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, count, color }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
        active
          ? 'bg-brand/15 border-brand/40 text-brand'
          : 'bg-transparent border-line text-slate-400 hover:text-slate-200 hover:border-line-bright'
      }`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className="tnum opacity-60">{count}</span>
    </button>
  );
}
