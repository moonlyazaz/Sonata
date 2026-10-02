import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { LikedPage } from '@/pages/LikedPage';
import { CollectionPage } from '@/pages/CollectionPage';
import { ArtistPage } from '@/pages/ArtistPage';
import { UserPlaylistPage } from '@/pages/UserPlaylistPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/placeholders';
import { useAuthStore } from '@/stores/authStore';

/**
 * `/playlist/:id` atende dois mundos: ids numéricos vêm do SoundCloud e caem
 * no `CollectionPage`; ids `pl_*` são playlists suas, salvas neste navegador.
 */
function PlaylistRoute() {
  const { id } = useParams<{ id: string }>();
  return id?.startsWith('pl_') ? <UserPlaylistPage /> : <CollectionPage />;
}

/**
 * Portão de sessão. Toda a área do app fica atrás dele — quem não tem sessão
 * validada nunca monta a sidebar, o player nem carrega dados do SoundCloud.
 *
 * O `status` começa em `analisando` e só vira `pronto` quando o `main.tsx`
 * chama `setBoot()`, antes mesmo de importar este módulo. Mantivemos a guarda
 * mesmo assim: se um dia o boot passar a ser assíncrono em relação à render,
 * um redirect cedo é melhor que flash de tela vazia.
 */
function Protegido({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'analisando') return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Router raiz — cada fase adiciona rotas aqui. */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fora do `Protegido`: é justamente a tela de quem não tem sessão. */}
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <Protegido>
              <AppShell />
            </Protegido>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/liked" element={<LikedPage />} />
          <Route path="/album/:id" element={<CollectionPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="/playlist/:id" element={<PlaylistRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
