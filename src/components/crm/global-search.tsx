'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useCRMStore, type Page } from '@/lib/store';
import {
  UserRound,
  Briefcase,
  CheckSquare,
  Users,
  Calendar,
  Search,
  Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProspectResult {
  id: string;
  nom: string;
  specialite: string | null;
  wilaya: string | null;
  isClient: boolean;
  type: 'prospect';
}

interface OpportunityResult {
  id: string;
  nomProjet: string;
  statut: string;
  montantEstime: number | null;
  client: { nom: string } | null;
  type: 'opportunity';
}

interface TaskResult {
  id: string;
  titre: string;
  statut: string;
  priorite: string;
  assigneA: { nom: string } | null;
  type: 'task';
}

interface EmployeeResult {
  id: string;
  nom: string;
  role: string;
  type: 'employee';
}

interface EventResult {
  id: string;
  nom: string;
  date: string;
  ville: string | null;
  type: 'event';
}

interface SearchResults {
  prospects: ProspectResult[];
  opportunities: OpportunityResult[];
  tasks: TaskResult[];
  employees: EmployeeResult[];
  events: EventResult[];
}

interface GlobalSearchProps {
  onSelectProspect?: (id: string) => void;
  onSelectOpportunity?: (id: string) => void;
  onSelectTask?: (id: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GROUP_CONFIG = [
  { key: 'prospects' as const, label: 'Prospects', icon: UserRound, page: 'prospects' as Page },
  { key: 'opportunities' as const, label: 'Opportunités', icon: Briefcase, page: 'opportunities' as Page },
  { key: 'tasks' as const, label: 'Tâches', icon: CheckSquare, page: 'tasks' as Page },
  { key: 'employees' as const, label: 'Employés', icon: Users, page: 'employees' as Page },
  { key: 'events' as const, label: 'Événements', icon: Calendar, page: 'events' as Page },
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatutLabel(statut: string): string {
  const labels: Record<string, string> = {
    Nouveau: 'Nouveau',
    En_cours: 'En cours',
    Negociation: 'Négociation',
    Gagne: 'Gagné',
    Perdu: 'Perdu',
    en_attente: 'En attente',
    en_cours: 'En cours',
    terminee: 'Terminée',
    annulee: 'Annulée',
  };
  return labels[statut] || statut;
}

function getPrioriteLabel(priorite: string): string {
  const labels: Record<string, string> = {
    basse: 'Basse',
    moyenne: 'Moyenne',
    haute: 'Haute',
    urgente: 'Urgente',
  };
  return labels[priorite] || priorite;
}

function getPrioriteVariant(priorite: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    urgente: 'destructive',
    haute: 'default',
    moyenne: 'secondary',
    basse: 'outline',
  };
  return map[priorite] || 'secondary';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GlobalSearch({ onSelectProspect, onSelectOpportunity, onSelectTask }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { setCurrentPage } = useCRMStore();

  // ─── Keyboard shortcut ──────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Debounced search ──────────────────────────────────────────────────

  const performSearch = useCallback((searchQuery: string) => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (searchQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data: SearchResults) => {
        if (!controller.signal.aborted) {
          setResults(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('[GlobalSearch]', err);
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // ─── Cleanup on close ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      // Small delay so the user doesn't see the content reset while closing
      const timer = setTimeout(() => {
        setQuery('');
        setResults(null);
        setLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ─── Result click handler ──────────────────────────────────────────────

  const handleSelect = useCallback(
    (type: string, id: string) => {
      setOpen(false);

      // Trigger optional callback for detail dialogs
      if (type === 'prospect' && onSelectProspect) {
        onSelectProspect(id);
      } else if (type === 'opportunity' && onSelectOpportunity) {
        onSelectOpportunity(id);
      } else if (type === 'task' && onSelectTask) {
        onSelectTask(id);
      }

      // Navigate to the module page
      const group = GROUP_CONFIG.find((g) => g.key === type + 's' || g.key === type + 'ies');
      if (group) {
        setCurrentPage(group.page);
      } else {
        // Fallback mapping
        const pageMap: Record<string, Page> = {
          prospect: 'prospects',
          opportunity: 'opportunities',
          task: 'tasks',
          employee: 'employees',
          event: 'events',
        };
        const page = pageMap[type];
        if (page) setCurrentPage(page);
      }
    },
    [onSelectProspect, onSelectOpportunity, onSelectTask, setCurrentPage]
  );

  // ─── Total results count ───────────────────────────────────────────────

  const totalResults = results
    ? results.prospects.length +
      results.opportunities.length +
      results.tasks.length +
      results.employees.length +
      results.events.length
    : 0;

  const hasQuery = query.trim().length >= 2;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger hint shown in sidebar/header area */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Ouvrir la recherche globale"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Recherche globale — DALIA"
        description="Recherchez dans les prospects, opportunités, tâches, employés et événements"
      >
        <CommandInput
          placeholder="Rechercher un prospect, opportunité, tâche…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Recherche en cours…</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && hasQuery && results && totalResults === 0 && (
            <CommandEmpty>Aucun résultat trouvé</CommandEmpty>
          )}

          {/* Results by group */}
          {!loading &&
            results &&
            GROUP_CONFIG.map(({ key, label, icon: Icon }) => {
              const items = results[key];
              if (!items || items.length === 0) return null;

              return (
                <CommandGroup
                  key={key}
                  heading={
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                      <Badge variant="secondary" className="ml-auto h-4 min-w-4 px-1 text-[10px]">
                        {items.length}
                      </Badge>
                    </div>
                  }
                >
                  {items.map((item) => {
                    if (item.type === 'prospect') {
                      const p = item as ProspectResult;
                      return (
                        <CommandItem
                          key={p.id}
                          value={`prospect-${p.nom}-${p.id}`}
                          onSelect={() => handleSelect('prospect', p.id)}
                          className="flex items-center gap-3"
                        >
                          <UserRound className="size-4 shrink-0 text-emerald-600" />
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="truncate text-sm font-medium">{p.nom}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[p.specialite, p.wilaya].filter(Boolean).join(' · ') || 'Prospect'}
                            </span>
                          </div>
                          {p.isClient && (
                            <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                              Client
                            </Badge>
                          )}
                        </CommandItem>
                      );
                    }

                    if (item.type === 'opportunity') {
                      const o = item as OpportunityResult;
                      return (
                        <CommandItem
                          key={o.id}
                          value={`opportunity-${o.nomProjet}-${o.id}`}
                          onSelect={() => handleSelect('opportunity', o.id)}
                          className="flex items-center gap-3"
                        >
                          <Briefcase className="size-4 shrink-0 text-amber-600" />
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="truncate text-sm font-medium">{o.nomProjet}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {o.client?.nom || 'Sans client'} · {formatCurrency(o.montantEstime)}
                            </span>
                          </div>
                          <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                            {getStatutLabel(o.statut)}
                          </Badge>
                        </CommandItem>
                      );
                    }

                    if (item.type === 'task') {
                      const t = item as TaskResult;
                      return (
                        <CommandItem
                          key={t.id}
                          value={`task-${t.titre}-${t.id}`}
                          onSelect={() => handleSelect('task', t.id)}
                          className="flex items-center gap-3"
                        >
                          <CheckSquare className="size-4 shrink-0 text-blue-600" />
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="truncate text-sm font-medium">{t.titre}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {t.assigneA?.nom || 'Non assignée'}
                            </span>
                          </div>
                          <Badge variant={getPrioriteVariant(t.priorite)} className="ml-auto shrink-0 text-[10px]">
                            {getPrioriteLabel(t.priorite)}
                          </Badge>
                        </CommandItem>
                      );
                    }

                    if (item.type === 'employee') {
                      const e = item as EmployeeResult;
                      return (
                        <CommandItem
                          key={e.id}
                          value={`employee-${e.nom}-${e.id}`}
                          onSelect={() => handleSelect('employee', e.id)}
                          className="flex items-center gap-3"
                        >
                          <Users className="size-4 shrink-0 text-purple-600" />
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="truncate text-sm font-medium">{e.nom}</span>
                          </div>
                          <Badge variant="outline" className="ml-auto shrink-0 text-[10px] capitalize">
                            {e.role}
                          </Badge>
                        </CommandItem>
                      );
                    }

                    if (item.type === 'event') {
                      const ev = item as EventResult;
                      return (
                        <CommandItem
                          key={ev.id}
                          value={`event-${ev.nom}-${ev.id}`}
                          onSelect={() => handleSelect('event', ev.id)}
                          className="flex items-center gap-3"
                        >
                          <Calendar className="size-4 shrink-0 text-rose-600" />
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="truncate text-sm font-medium">{ev.nom}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatDate(ev.date)}{ev.ville ? ` · ${ev.ville}` : ''}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    }

                    return null;
                  })}
                </CommandGroup>
              );
            })}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default GlobalSearch;
