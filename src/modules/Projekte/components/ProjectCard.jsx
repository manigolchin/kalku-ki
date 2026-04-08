import { Trash2, Calendar, Layers, Briefcase } from 'lucide-react';
import clsx from 'clsx';

/**
 * Format a number as EUR currency (German locale).
 */
function formatEUR(n) {
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20AC';
}

/**
 * Format an ISO date string to a short German date.
 */
function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ProjectCard({ project, onClick, onDelete }) {
  const {
    id,
    name,
    client,
    service,
    deadline,
    position_count = 0,
    netto,
    created_at,
  } = project;

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div
      onClick={() => onClick(id)}
      className={clsx(
        'group relative bg-white border border-slate-200/80 rounded-2xl p-5',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        'hover:shadow-md hover:border-slate-300/80',
        'transition-all duration-200 cursor-pointer',
      )}
    >
      {/* Delete button - visible on hover */}
      <button
        onClick={handleDelete}
        className={clsx(
          'absolute top-3 right-3 p-1.5 rounded-lg',
          'text-slate-300 hover:text-red-500 hover:bg-red-50',
          'opacity-0 group-hover:opacity-100',
          'transition-all duration-150 cursor-pointer',
        )}
        title="Projekt löschen"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Project name */}
      <h3 className="text-sm font-semibold text-slate-800 pr-8 leading-snug line-clamp-2">
        {name || 'Unbenanntes Projekt'}
      </h3>

      {/* Client */}
      {client && (
        <div className="flex items-center gap-1.5 mt-2">
          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 truncate">{client}</span>
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {service && (
          <span className="badge bg-primary-50 text-primary-600 border border-primary-100">
            {service}
          </span>
        )}
        {deadline && (
          <span className="inline-flex items-center gap-1 badge bg-amber-50 text-amber-600 border border-amber-100">
            <Calendar className="w-3 h-3" />
            {formatDate(deadline)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Layers className="w-3.5 h-3.5" />
          <span>{position_count} {position_count === 1 ? 'Position' : 'Positionen'}</span>
        </div>
        {netto != null && netto > 0 && (
          <span className="text-xs font-semibold font-mono text-brand-600">
            {formatEUR(netto)}
          </span>
        )}
      </div>

      {/* Created date */}
      {created_at && (
        <p className="text-[10px] text-slate-300 mt-2">
          Erstellt am {formatDate(created_at)}
        </p>
      )}
    </div>
  );
}
