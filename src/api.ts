import { create } from "zustand";
export const backend = (
  import.meta.env.VITE_SERVER_URL || location.origin
).replace(/\/$/, "");
type State = {
  token: string;
  home: any;
  error: string;
  liveStatus: "connecting" | "online" | "offline";
  set: (v: Partial<State>) => void;
};
export const useApp = create<State>((set) => ({
  token: localStorage.mesaToken || "",
  home: null,
  error: "",
  liveStatus: "connecting",
  set,
}));
export async function api(cmd: string, params: any = {}) {
  const token = useApp.getState().token;
  const res = await fetch(backend + "/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ ...params, cmd }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === "Entre novamente." && token === useApp.getState().token)
      session("");
    throw Error(data.error || "Falha de conexão.");
  }
  return data;
}
export function session(token: string) {
  localStorage.mesaToken = token;
  useApp.getState().set({ token, home: null, liveStatus: "connecting" });
}
export const fail = (e: any) =>
  useApp.getState().set({ error: e.message || String(e) });
let newestRefresh = 0;
export const refresh = async () => {
  const revision = ++newestRefresh;
  const t = useApp.getState().token;
  const home = await api("home");
  if (revision === newestRefresh && t === useApp.getState().token)
    useApp.getState().set({ home });
};
export const num = (n: number) => n?.toLocaleString("pt-BR");
export const date = (t: number) =>
  new Date(t).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
