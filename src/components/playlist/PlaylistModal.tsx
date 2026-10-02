import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton } from '@/components/glass';
import { GlassModal } from '@/components/glass/GlassModal';
import { useLibraryStore, type UserPlaylist } from '@/stores/libraryStore';

interface PlaylistModalProps {
  open: boolean;
  onClose: () => void;
  /** Se vier, edita essa playlist; senão, cria uma nova. */
  playlist?: UserPlaylist | null;
  /** Depois de criar, navega pra página nova (a edição fica onde está). */
  onCreated?: (id: string) => void;
}

/**
 * Modal de vidro para criar ou renomear playlist.
 * O `autoFocus` no input é seguro: o atalho global de Space ignora campos
 * de texto, então a tecla só digita o espaço mesmo.
 */
export function PlaylistModal({ open, onClose, playlist, onCreated }: PlaylistModalProps) {
  const navigate = useNavigate();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist);

  const editing = Boolean(playlist);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  // Reseta sempre que abre, para não reapresentar o valor da última sessão
  useEffect(() => {
    if (!open) return;
    setName(playlist?.name ?? '');
    setDescription(playlist?.description ?? '');
    setTouched(false);
  }, [open, playlist]);

  const error = touched && name.trim().length === 0;
  const disabled = name.trim().length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (disabled) return;

    if (playlist) {
      updatePlaylist(playlist.id, { name: name.trim(), description: description.trim() });
      onClose();
      return;
    }

    const id = createPlaylist(name.trim(), description.trim());
    onClose();
    onCreated?.(id);
    navigate(`/playlist/${id}`);
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar playlist' : 'Nova playlist'}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-faint mb-1.5 block text-xs font-semibold tracking-wider uppercase">
            Nome
          </span>
          <input
            className={`glass-input w-full ${error ? 'border-red-400/70' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            placeholder="Ex.: Chill da madrugada"
            maxLength={60}
            autoFocus
            aria-invalid={error}
          />
          {error && (
            <span className="text-red-400 mt-1 block text-xs">
              Dê um nome pra playlist.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-faint mb-1.5 block text-xs font-semibold tracking-wider uppercase">
            Descrição <span className="normal-case font-normal">(opcional)</span>
          </span>
          <textarea
            className="glass-input min-h-[76px] w-full resize-none py-2.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Do que ela trata?"
            maxLength={200}
          />
        </label>

        <div className="flex justify-end gap-3 pt-1">
          <GlassButton type="button" onClick={onClose}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" variant="accent" disabled={disabled}>
            {editing ? 'Salvar' : 'Criar playlist'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
}
