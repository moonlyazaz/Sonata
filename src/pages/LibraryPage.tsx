import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock3, Heart, Plus } from 'lucide-react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { MediaCard } from '@/components/music/MediaCard';
import { TrackRow } from '@/components/music/TrackRow';
import { PlaylistModal } from '@/components/playlist/PlaylistModal';
import { usePlayList } from '@/hooks/usePlayList';
import { bigArtwork } from '@/lib/soundcloud';
import { storedToTrack } from '@/lib/stored';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

const TABS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'recent', label: 'Recentes' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Sua biblioteca: playlists criadas por você + o que você andou ouvindo. */
export function LibraryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  const tab = (TABS.some((t) => t.id === params.get('tab'))
    ? params.get('tab')
    : 'playlists') as TabId;

  const playlists = useLibraryStore((s) => s.playlists);
  const recentIds = useLibraryStore((s) => s.recentIds);
  const recentTracks = useLibraryStore((s) => s.recentTracks);

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => recentTracks[id])
        .filter(Boolean)
        .map(storedToTrack),
    [recentIds, recentTracks],
  );

  const playRecent = usePlayList('Recentemente ouvidas');
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const setTab = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === 'playlists') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-faint text-xs font-semibold tracking-wider uppercase">Sua música</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Sua Biblioteca</h1>
        </div>
        <GlassButton variant="accent" onClick={() => setCreating(true)}>
          <Plus size={17} /> Nova playlist
        </GlassButton>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Seções da biblioteca">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`glass-chip transition ${
              tab === t.id ? 'is-active' : 'opacity-70 hover:opacity-100'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Playlists ---------------- */}
      {tab === 'playlists' && (
        <section>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* Curtidas é uma playlist virtual — não mora na lista normal */}
            <button
              className="glass-card group cursor-pointer p-3 text-left"
              onClick={() => navigate('/liked')}
            >
              <div
                className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl"
                style={{ background: 'linear-gradient(135deg,#0284c7,#38bdf8)' }}
              >
                <Heart size={44} fill="#fff" color="#fff" />
              </div>
              <p className="truncate text-sm font-semibold">Curtidas</p>
              <p className="text-faint mt-0.5 truncate text-xs">Playlist</p>
            </button>

            {playlists.map((p) => (
              <MediaCard
                key={p.id}
                image={
                  bigArtwork(p.cover, 't500x500') ??
                  p.tracks[0]?.user.avatar_url ??
                  null
                }
                title={p.name}
                subtitle={`${p.tracks.length} ${p.tracks.length === 1 ? 'faixa' : 'faixas'}`}
                onClick={() => navigate(`/playlist/${p.id}`)}
              />
            ))}

            <button
              className="glass-card group cursor-pointer p-3 text-left"
              onClick={() => setCreating(true)}
            >
              <div className="mb-3 flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/4 transition group-hover:border-white/40 group-hover:bg-white/8">
                <Plus size={38} className="text-faint transition group-hover:text-white" />
              </div>
              <p className="truncate text-sm font-semibold">Nova playlist</p>
              <p className="text-faint mt-0.5 truncate text-xs">Criar do zero</p>
            </button>
          </div>

          {playlists.length === 0 && (
            <p className="text-faint mt-5 text-sm">
              Nenhuma playlist criada ainda — a primeira pode ser feita no cartão acima ou no
              botão “Nova playlist”.
            </p>
          )}
        </section>
      )}

      {/* ---------------- Recentes ---------------- */}
      {tab === 'recent' && (
        <section>
          {recent.length === 0 ? (
            <GlassPanel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="text-accent">
                <Clock3 size={34} />
              </span>
              <p className="text-lg font-semibold">Nada ouvido ainda</p>
              <p className="text-muted max-w-md text-sm leading-relaxed">
                As últimas20 músicas que você tocou aparecem aqui automaticamente.
              </p>
              <GlassButton onClick={() => navigate('/search')}>Explorar músicas</GlassButton>
            </GlassPanel>
          ) : (
            <GlassPanel className="p-2">
              <ul>
                {recent.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    index={i + 1}
                    recordRecent={false}
                    isCurrent={currentId === t.id}
                    isPlaying={isPlaying}
                    contextLabel="Recentemente ouvidas"
                    onPlay={(track) => playRecent(track, recent, 'Recentemente ouvidas')}
                    onArtistClick={(id) => navigate(`/artist/${id}`)}
                  />
                ))}
              </ul>
            </GlassPanel>
          )}
        </section>
      )}

      <PlaylistModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
