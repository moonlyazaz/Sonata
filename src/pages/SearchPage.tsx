import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock3, Search as SearchIcon, Trash2, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass';
import { MediaCard, artwork } from '@/components/music/MediaCard';
import { TrackRow } from '@/components/music/TrackRow';
import { useSearch, type SearchTab } from '@/hooks/useSearch';
import { playCollectionById, usePlayList } from '@/hooks/usePlayList';
import { usePlayerStore } from '@/stores/playerStore';
import { load, save, STORAGE_KEYS } from '@/lib/storage';

const TABS: Array<{ id: SearchTab; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'tracks', label: 'Músicas' },
  { id: 'artists', label: 'Artistas' },
  { id: 'playlists', label: 'Playlists' },
];

/** Tela de busca: abas, resultados e buscas recentes. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const tab = (params.get('tab') as SearchTab) || 'all';

  const { results, loading, error } = useSearch(q, tab);
  const [recent, setRecent] = useState<string[]>(() => load<string[]>(STORAGE_KEYS.searches, []));

  // player: tocar a lista inteira a partir da faixa clicada
  const playList = usePlayList();
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Registra a busca quando o usuário para de digitar (q estabilizado na URL)
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      save(STORAGE_KEYS.searches, next);
      return next;
    });
  }, [q]);

  const setTab = (next: SearchTab) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  const clearRecent = () => {
    setRecent([]);
    save(STORAGE_KEYS.searches, []);
  };

  const removeRecent = (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((t) => t !== term);
      save(STORAGE_KEYS.searches, next);
      return next;
    });
  };

  const go = (term: string) => navigate(`/search?q=${encodeURIComponent(term)}`);

  const isEmpty =
    !loading &&
    !error &&
    results.tracks.length === 0 &&
    results.artists.length === 0 &&
    results.playlists.length === 0;

  /* ---------------- estado vazio: buscas recentes ---------------- */
  if (!q.trim()) {
    return (
      <div className="space-y-6 py-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Buscar</h1>
          <p className="text-muted text-sm">
            Procure músicas, artistas e playlists no catálogo do SoundCloud.
          </p>
        </header>

        {recent.length > 0 ? (
          <GlassPanel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 size={16} className="text-muted" /> Buscas recentes
              </h2>
              <button
                className="text-faint hover:text flex items-center gap-1 text-xs transition"
                onClick={clearRecent}
              >
                <Trash2 size={13} /> Limpar tudo
              </button>
            </div>
            <ul className="space-y-1">
              {recent.map((term) => (
                <li key={term} className="group flex items-center gap-2">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                    onClick={() => go(term)}
                  >
                    <SearchIcon size={15} className="text-faint shrink-0" />
                    <span className="truncate text-sm">{term}</span>
                  </button>
                  <button
                    className="glass-icon-btn !h-7 !w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => removeRecent(term)}
                    aria-label={`Remover ${term} do histórico`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassPanel>
        ) : (
          <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
            <SearchIcon size={34} className="text-faint" />
            <p className="text-muted text-sm">
              Digite algo na barra de busca acima para começar.
            </p>
          </GlassPanel>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold">Experimente</h2>
          <div className="flex flex-wrap gap-2">
            {['techno', 'lofi hip hop', 'drum and bass', 'mpb', 'indie rock', 'trap'].map((t) => (
              <button key={t} className="glass-chip" onClick={() => go(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- resultados ---------------- */
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold">
          Resultados para <span className="text-accent">“{q}”</span>
        </h1>

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`glass-chip ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <GlassPanel className="p-6">
          <p className="text-sm">
            Falha na busca: <strong>{error}</strong>
          </p>
          <p className="text-faint mt-1 text-xs">
            Verifique se o dev server está rodando (proxy <code>/sc/api</code>).
          </p>
        </GlassPanel>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-skeleton h-14" />
          ))}
        </div>
      )}

      {isEmpty && !loading && (
        <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
          <SearchIcon size={34} className="text-faint" />
          <p className="text-sm font-semibold">Nada encontrado para “{q}”</p>
          <p className="text-faint max-w-sm text-xs">
            Verifique a grafia ou tente termos mais genéricos.
          </p>
        </GlassPanel>
      )}

      {/* Músicas */}
      {(tab === 'all' || tab === 'tracks') && results.tracks.length > 0 && (
        <section>
          {tab === 'all' && <h2 className="mb-3 text-lg font-bold">Músicas</h2>}
          <GlassPanel className="p-2">
            <ul>
              {results.tracks.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i + 1}
                  isCurrent={currentId === t.id}
                  isPlaying={isPlaying}
                  contextLabel={`Busca: ${q}`}
                  onPlay={(track) => playList(track, results.tracks, `Busca: ${q}`)}
                  onArtistClick={(id) => navigate(`/artist/${id}`)}
                />
              ))}
            </ul>
          </GlassPanel>
        </section>
      )}

      {/* Artistas */}
      {(tab === 'all' || tab === 'artists') && results.artists.length > 0 && (
        <section>
          {tab === 'all' && <h2 className="mb-3 text-lg font-bold">Artistas</h2>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {results.artists.map((a) => (
              <MediaCard
                key={a.id}
                image={a.avatar_url ?? null}
                title={a.full_name || a.username}
                subtitle={`${a.track_count ?? 0} faixas`}
                shape="circle"
                onClick={() => navigate(`/artist/${a.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      {(tab === 'all' || tab === 'playlists') && results.playlists.length > 0 && (
        <section>
          {tab === 'all' && <h2 className="mb-3 text-lg font-bold">Playlists</h2>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {results.playlists.map((p) => (
              <MediaCard
                key={p.id}
                image={artwork(p.artwork_url)}
                title={p.title}
                subtitle={`${p.track_count ?? 0} faixas${p.is_album ? ' · Álbum' : ''}`}
                onClick={() => navigate(`/${p.is_album ? 'album' : 'playlist'}/${p.id}`)}
                onPlay={() => void playCollectionById(p.id, p.title)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
