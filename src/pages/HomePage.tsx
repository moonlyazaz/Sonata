import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, Radio } from 'lucide-react';
import { GlassCard, GlassPanel } from '@/components/glass';
import { TrackRow } from '@/components/music/TrackRow';
import { bigArtwork, sc, type ScPlaylist, type ScSelection, type ScTrack } from '@/lib/soundcloud';
import { playCollectionById, usePlayList } from '@/hooks/usePlayList';
import { usePlayerStore } from '@/stores/playerStore';

interface HomeData {
  selections: ScSelection[];
  trending: ScTrack[];
}

/**
 * Home: só conteúdo. Os cards de demonstração da Fase 0 (Painel / Cartão /
 * Controles), o modal de exemplo e o cabeçalho de marca saíram — a marca vive
 * na barra lateral.
 *
 * Duas seções: a grade de playlists curadas e o "Em alta agora".
 */
export function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [status, setStatus] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [erro, setErro] = useState('');

  const playList = usePlayList('Em alta');
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [selectionsPage, trendingUrn] = await Promise.all([
          sc.mixedSelections(),
          sc.systemPlaylist(
            'soundcloud:system-playlists:trending-by-genre:all-genres',
          ).catch(() => null),
        ]);

        if (cancelled) return;

        // system-playlists devolve só IDs → resolve em lote
        const stubIds = (trendingUrn?.tracks ?? [])
          .map((t) => ('title' in t && t.title ? null : t.id))
          .filter((id): id is number => id !== null);

        const trending = stubIds.length
          ? await sc.tracksByIds(stubIds)
          : ((trendingUrn?.tracks ?? []) as ScTrack[]);

        if (cancelled) return;
        setData({
          selections: selectionsPage.collection,
          trending: trending.slice(0, 10),
        });
        setStatus('ok');
      } catch (e) {
        if (!cancelled) {
          setErro(e instanceof Error ? e.message : String(e));
          setStatus('erro');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10 py-6">
      {/* -------- Estado: carregando / erro -------- */}
      {status === 'carregando' && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="glass-skeleton aspect-square" />
              <div className="glass-skeleton h-4 w-3/4" />
            </div>
          ))}
        </section>
      )}

      {status === 'erro' && (
        <GlassPanel className="p-6">
          <p className="text-muted text-sm">
            Não foi possível falar com o SoundCloud: <strong className="text">{erro}</strong>
          </p>
          <p className="text-faint mt-2 text-xs">
            Confira se o dev server está ativo — o proxy <code>/sc/api</code> resolve o CORS.
          </p>
        </GlassPanel>
      )}

      {/* -------- Playlists curadas -------- */}
      {status === 'ok' && data && (
        <>
          <section>
            <div className="mb-4 flex items-center gap-3">
              <Radio size={18} className="text-accent" />
              {/* Título descritivo: a grade traz todas as curadorias juntas,
                  não só a primeira playlist (antes aparecia "Buzzing Mexico"
                  por causa do `heroTitle`, que lia o título da 1ª faixa). */}
              <h1 className="text-xl font-bold">Curadoria do SoundCloud</h1>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {data.selections.flatMap((sel) =>
                (sel.items.collection ?? []).slice(0, 5).map((raw) => {
                  const pl = raw as ScPlaylist;
                  const art = bigArtwork(pl.artwork_url, 't500x500');
                  const cardTitle = pl.title ?? 'Sem título';
                  return (
                    <GlassCard
                      key={`${sel.id}-${pl.id}`}
                      className="group cursor-pointer p-3"
                      onClick={() => navigate(`/${pl.is_album ? 'album' : 'playlist'}/${pl.id}`)}
                    >
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl">
                        {art ? (
                          <img src={art} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-white/10" />
                        )}
                        <button
                          className="absolute right-2 bottom-2 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-[var(--accent)] opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                          aria-label={`Tocar ${cardTitle}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void playCollectionById(pl.id, cardTitle);
                          }}
                        >
                          <Play size={16} fill="#04121d" color="#04121d" />
                        </button>
                      </div>
                      <p className="truncate text-sm font-semibold">{cardTitle}</p>
                      <p className="text-faint mt-0.5 truncate text-xs">{sel.title}</p>
                    </GlassCard>
                  );
                }),
              )}
            </div>
          </section>

          {/* -------- Trending -------- */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <Search size={18} className="text-muted" />
              <h2 className="text-xl font-bold">Em alta agora</h2>
            </div>

            <GlassPanel scroll className="max-h-[420px] p-2">
              <ul>
                {data.trending.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    index={i + 1}
                    isCurrent={currentId === t.id}
                    isPlaying={isPlaying}
                    contextLabel="Em alta agora"
                    onPlay={(track) => playList(track, data.trending, 'Em alta agora')}
                    onArtistClick={(id) => navigate(`/artist/${id}`)}
                  />
                ))}
              </ul>
            </GlassPanel>
          </section>
        </>
      )}
    </div>
  );
}
