import { Face } from "./PlayerIdentity";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Trophy,
  History as Clock,
  UsersRound,
  UserRound,
  Shield,
  Coins,
  LogOut,
  X,
  Menu,
  Bell,
} from "lucide-react";
import { Wallet } from "./CashTools";
import Auth from "./Auth";
import Lobby, { Invite } from "./Lobby";
import Table from "./Table";
import { History, Tours, People, Profile, Admin, RakeControl } from "./Club";
import { api, session, useApp, refresh, fail, backend } from "./api";
import { Brand, Modal } from "./ui";
import { LoadingGate } from "./ProgressSplash";
import "./style.css";
import "./mobile-game-redesign.css";
import "./poker-royale.css";
import "./poker-royale-stage.css";

import "./poker-royale-seats-finish.css";

function App() {
  const { token, home, error, set } = useApp(),
    [wallet, W] = useState(false),
    [menu, M] = useState(false),
    [notices, setNotices] = useState(false),
    [invite, I] = useState(() => {
      const code = new URLSearchParams(location.search).get("convite");
      if (code) sessionStorage.setItem("mesa-invite", code);
      return code || sessionStorage.getItem("mesa-invite") || "";
    }),
    loc = useLocation();
  useEffect(() => {
    M(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => set({ error: "" }), 6500);
    return () => clearTimeout(t);
  }, [error]);
  useEffect(() => {
    if (!token) return;
    let alive = true,
      ws: WebSocket,
      t,
      loading = false,
      again = false;
    const sync = async () => {
      if (!alive) return;
      if (loading) {
        again = true;
        return;
      }
      loading = true;
      try {
        await refresh();
      } catch (e) {
        if (alive) fail(e);
      } finally {
        loading = false;
        if (again) {
          again = false;
          sync();
        }
      }
    };
    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(backend.replace(/^http/, "ws") + "/live");
      ws.onopen = () => ws.send(token);
      ws.onmessage = () => {
        if (alive) {
          set({ liveStatus: "online" });
          sync();
        }
      };
      ws.onclose = () => {
        if (alive) {
          set({ liveStatus: "offline" });
          t = setTimeout(connect, 1500);
        }
      };
    };
    let cloudConnection: any, channel: any;
    fetch(backend + "/api/config")
      .then((r) => r.json())
      .then(async (cfg) => {
        if (!cfg.supabase || !alive) return;
        const { createClient } = await import("@supabase/supabase-js");
        if (!alive) return;
        cloudConnection = createClient(cfg.supabase.url, cfg.supabase.key);
        channel = cloudConnection
          .channel("mesa-lobby")
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "mesa_lobby_clock" },
            sync,
          )
          .subscribe();
      })
      .catch(() => {});
    sync();
    connect();
    const resume = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    const poll = setInterval(sync, 15000);
    return () => {
      alive = false;
      if (channel) cloudConnection.removeChannel(channel);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      clearInterval(poll);
      clearTimeout(t);
      ws?.close();
    };
  }, [token]);
  useEffect(() => {
    document.documentElement.dataset.cardStyle =
      home?.me.appearance?.cards ??
      localStorage.getItem("mesa-card-style") ??
      "vivid";
  }, [home?.me.id, home?.me.appearance?.cards]);
  const links: any[] = [
    ["/", "Lobby", LayoutGrid],

    ["/historico", "Histórico", Clock],
    ["/jogadores", "Jogadores", UsersRound],
    ["/perfil", "Meu perfil", UserRound],
    ["/torneios", "Torneios", Trophy],
  ];
  if (home?.me.admin) links.push(["/admin", "Caixa", Shield]);
  return (
    <LoadingGate key={token ? "session:" + token : "guest"} ready={!token || !!home} title={token ? "CARREGANDO O PRÉ-JOGO" : "INICIANDO POKER ROYALE"}>
      <>
      {!token ? (
        <Auth />
      ) : !home ? (
        <div className="loading">
          <Brand />
          <p>Conectando ao clube…</p>
        </div>
      ) : (
        <div
          className={[
            "shell",
            loc.pathname === "/" ? "lobby-shell" : "",
            home.me.preferences.motion ? "reduce" : "",
            "back-" + home.me.preferences.back,
            "chip-" + home.me.preferences.chip,
            "face-" + home.me.preferences.face,
            "theme-" + home.me.preferences.theme,
            "speed-" + home.me.preferences.speed,
          ].join(" ")}
        >
          <aside className={menu ? "shown" : ""}>
            <Brand />
            <div className="navgroup">CLUBE</div>
            <nav>
              {links.map(([path, text, Icon]) => (
                <NavLink key={path} to={path} end>
                  <Icon size={18} />
                  {text}
                </NavLink>
              ))}
            </nav>
            <div className="sidefoot">
              <span className="avatar">
                <Face player={home.me} />
              </span>
              <span>
                <b>{home.me.name}</b>
                <small>Jogador do clube</small>
              </span>
              <button
                className="icon"
                aria-label="Sair da conta"
                onClick={async () => {
                  try {
                    await api("logout");
                  } finally {
                    session("");
                  }
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </aside>
          <main className="content">
            <header>
              <button
                className="mobile icon"
                aria-label="Menu"
                onClick={() => M(!menu)}
              >
                <Menu />
              </button>
              {loc.pathname === "/" && (
                <div className="lobby-mobile-brand">
                  <Brand />
                </div>
              )}
              <span className="crumb">
                Clube <i>/</i>{" "}
                <b>{links.find((l) => l[0] === loc.pathname)?.[1] || "Mesa"}</b>
              </span>
              <button
                className="icon club-notices"
                aria-label="Notificações"
                onClick={() => setNotices(true)}
              >
                <Bell size={18} />
                {home.me.notices?.length + home.me.invites.length > 0 && (
                  <sup>{home.me.notices.length + home.me.invites.length}</sup>
                )}
              </button>
              <div className="club-wallets">
                <span className="club-wallet club-wallet-bank">
                  <Coins size={15} />
                  <b>{home.clubChips?.toLocaleString("pt-BR") ?? "0"}</b>
                  <small>Clube</small>
                  {home.me.admin && (
                    <NavLink to="/admin" aria-label="Abrir caixa">
                      +
                    </NavLink>
                  )}
                </span>
                <button
                  className="club-wallet"
                  onClick={() => W(true)}
                  aria-label="Abrir minha carteira"
                >
                  <Coins size={15} />
                  <b>{home.me.wallet.toLocaleString("pt-BR")}</b>
                  <small>Minhas fichas</small>
                </button>
              </div>
            </header>
            <motion.div
              className="page"
              key={loc.pathname}
              initial={home.me.preferences.motion ? false : { opacity: 0.65 }}
              animate={{ opacity: 1 }}
            >
              <Routes>
                <Route path="/" element={<Lobby />} />
                <Route path="/mesa/:id" element={<Table />} />
                <Route path="/torneios" element={<Tours />} />
                <Route path="/historico" element={<History />} />
                <Route path="/jogadores" element={<People />} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/rake" element={<RakeControl />} />
                <Route path="*" element={<Lobby />} />
              </Routes>
            </motion.div>
            {loc.pathname === "/" && (
              <nav className="lobby-app-nav" aria-label="Navegação do clube">
                {links
                  .filter(([path]) => path !== "/admin" && path !== "/torneios")
                  .map(([path, label, Icon]) => (
                    <NavLink key={path} to={path} end>
                      <Icon size={21} />
                      <span>{path === "/perfil" ? "Perfil" : label}</span>
                    </NavLink>
                  ))}
              </nav>
            )}
          </main>
          {wallet && <Wallet close={() => W(false)} />}
          {notices && (
            <Modal title="Notificações" close={() => setNotices(false)}>
              {!home.me.notices.length && !home.me.invites.length && (
                <p>Nenhuma notificação nova.</p>
              )}
              {home.me.invites.map((item) => (
                <button
                  key={item.room}
                  onClick={() => {
                    setNotices(false);
                    I(item.code);
                  }}
                >
                  {item.from} convidou você · {item.name}
                </button>
              ))}
              {home.me.notices.map((item) => (
                <p key={item.id}>{item.message}</p>
              ))}
              {!!home.me.notices.length && (
                <button
                  onClick={async () => {
                    try {
                      await api("readNotices");
                      await refresh();
                    } catch (error) {
                      fail(error);
                    }
                  }}
                >
                  Marcar como lidas
                </button>
              )}
            </Modal>
          )}
          {invite && (
            <Invite
              code={invite}
              close={() => {
                I("");
                sessionStorage.removeItem("mesa-invite");
                const url = new URL(location.href);
                url.searchParams.delete("convite");
                window.history.replaceState(window.history.state, "", url);
              }}
            />
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="toast">
          {error}
          <button aria-label="Fechar aviso" onClick={() => set({ error: "" })}>
            <X size={14} />
          </button>
        </div>
      )}
      </>
    </LoadingGate>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});



import "./poker-royale-history-board-reform.css";



import "./poker-royale-vip-stage.css";

import "./poker-royale-hand-label-fix.css";
import "./poker-royale-golden-rail.css";

import "./poker-royale-predeal-allin.css";



import "./poker-royale-special-events.css";
import "./poker-royale-ux-finish.css";

/* Authoritative final board, dealer and score styles. */
import "./royale-ui-system.css";
import "./poker-royale-board-system.css";
import "./poker-royale-photo-fix.css";
import "./poker-royale-mobile-orientation.css";
import "./royale-loading-screen.css";
