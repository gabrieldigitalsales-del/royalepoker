import React, { useRef, useState } from "react";
import { api, backend, fail, refresh, num } from "./api";
import { Modal, Field } from "./ui";

export const freeAvatarNames = [
  "Tubarão Royal", "Tubarão VIP", "Lobo de Aço", "Tigre Imperial",
  "Leão Coroado", "Raposa Astuta", "Pantera Noturna", "Águia Imperial",
  "Ficha de Espadas", "Ficha Rubi", "Par de Ases", "Coroa do Poker",
  "Gorila de Ouro", "Cobra Turquesa", "Urso do Cassino", "Dragão Royal",
];

function FreeAvatarImage({ index }: { index: number }) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return <span className="royale-avatar-art" role="img" aria-label={freeAvatarNames[index]}
    style={{ backgroundPosition: `${col * 100 / 3}% ${row * 100 / 3}%` }} />;
}

export function Face({ player }: { player: any }) {
  const photoId = player?.photo;
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const freeAvatar = Number.isInteger(player?.freeAvatar) && player.freeAvatar >= 0 && player.freeAvatar < 16 ? player.freeAvatar : null;
  const showFreeAvatar = freeAvatar !== null && !player?.shopAvatar;
  const hasPhoto = !showFreeAvatar && !!photoId && brokenPhoto !== photoId;
  const hasPersonalAvatar = !showFreeAvatar && !hasPhoto && !!(player?.shopAvatar || player?.customAvatar);
  return (
    <span className={"player-face" + (showFreeAvatar ? " player-face--free" : hasPhoto ? " player-face--photo" : hasPersonalAvatar ? " player-face--custom" : "")}>
      {showFreeAvatar ? (
        <FreeAvatarImage index={freeAvatar!} />
      ) : hasPhoto ? (
        <img
          alt=""
          loading="lazy"
          src={backend + "/avatar/" + encodeURIComponent(photoId)}
          onError={() => setBrokenPhoto(photoId)}
        />
      ) : (
        player?.avatar || player?.name?.slice(0, 2).toUpperCase()
      )}
      {player?.vip && <b className="face-vip">VIP</b>}
    </span>
  );
}
export function PhotoEditor({ player }) {
  const [busy, B] = useState(false);
  const [open, setOpen] = useState(false);
  async function choose(selection: number | null) {
    B(true);
    try {
      await api("selectFreeAvatar", { selection });
      await refresh();
      setOpen(false);
    } catch (err) {
      fail(err);
    } finally {
      B(false);
    }
  }
  return (
    <div className="photo-editor">
      <Face player={player} />
      <label className="photo-pick">
        Trocar foto
        <input
          disabled={busy}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            B(true);
            const url = URL.createObjectURL(file);
            try {
              if (file.size > 12 * 1024 * 1024)
                throw Error("Escolha uma imagem de até 12 MB.");
              const img = new Image();
              img.src = url;
              await img.decode();
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 96;
              const ctx = canvas.getContext("2d");
              const size = Math.min(img.width, img.height);
              ctx.fillStyle = "#1b1128";
              ctx.fillRect(0, 0, 96, 96);
              ctx.drawImage(
                img,
                (img.width - size) / 2,
                (img.height - size) / 2,
                size,
                size,
                0,
                0,
                96,
                96,
              );
              await api("photo", {
                jpeg: canvas.toDataURL("image/jpeg", 0.7).split(",")[1],
              });
              await refresh();
            } catch (err) {
              fail(err);
            } finally {
              URL.revokeObjectURL(url);
              B(false);
            }
          }}
        />
      </label>
      <button type="button" disabled={busy} onClick={() => setOpen(true)}>
        Avatares grátis
      </button>
      {open && (
        <Modal title="Avatares grátis · Poker Royale" close={() => setOpen(false)}>
          <p>16 ilustrações exclusivas para escolher, sem diamantes ou compras.</p>
          <div className="royale-avatar-grid" role="group" aria-label="Avatares gratuitos">
            {freeAvatarNames.map((name, index) => (
              <button key={name} type="button" className="royale-avatar-option"
                aria-pressed={player.freeAvatar === index && !player.shopAvatar}
                disabled={busy} onClick={() => choose(index)}>
                <FreeAvatarImage index={index} />
                <span>{name}</span>
                {player.freeAvatar === index && !player.shopAvatar && <small>Selecionado</small>}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => choose(null)}>Usar foto ou avatar pessoal</button>
        </Modal>
      )}
      {player.photo && (
        <button
          disabled={busy}
          onClick={async () => {
            B(true);
            try {
              await api("photo");
              await refresh();
            } catch (err) {
              fail(err);
            } finally {
              B(false);
            }
          }}
        >
          Remover foto
        </button>
      )}
    </div>
  );
}
export function Grant({ person, room, destination, close }: any) {
  const [value, V] = useState(""),
    [busy, B] = useState(false),
    [done, D] = useState("");
  const receipt = useRef<{ amount: number; ref: string }>();
  const amount = Number(value);
  return (
    <Modal title={"Adicionar fichas · " + person.name} close={close}>
      {done ? (
        <div className="grant-confirmation" role="status"><i aria-hidden="true">♣</i><strong>+{num(amount)} fichas</strong><span>Crédito na {done} de {person.name}</span></div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            B(true);
            try {
              if (receipt.current?.amount !== amount)
                receipt.current = {
                  amount,
                  ref: Array.from(
                    crypto.getRandomValues(new Uint8Array(16)),
                    (v) => v.toString(16).padStart(2, "0"),
                  ).join(""),
                };
              const result = await api("grantChips", {
                room,
                id: person.id,
                amount,
                reference: receipt.current.ref,
                destination,
              });
              D(result.destination);
              await refresh();
            } catch (err) {
              fail(err);
            } finally {
              B(false);
            }
          }}
        >
          <p>
            Destino ·{" "}
            {destination === "mesa" ? "Stack na mesa" : "Carteira do jogador"}
          </p>
          <Field title="Quantidade de fichas">
            <input
              autoFocus
              type="number"
              min="1"
              step="1"
              required
              value={value}
              onChange={(e) => V(e.target.value)}
            />
          </Field>
          <button
            className="primary"
            disabled={busy || !Number.isSafeInteger(amount) || amount < 1}
          >
            Confirmar crédito
          </button>
        </form>
      )}
    </Modal>
  );
}
