import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { api, session, backend, fail } from "./api";
import { Brand, Field } from "./ui";
import GameHero from "./GameHero";
export default function Auth() {
  const [mode, M] = useState("login"),
    [beta, Beta] = useState(false),
    [busy, B] = useState(false),
    [recovery, R] = useState(""),
    [notice, N] = useState(""),
    [cloud, C] = useState<any>(null);
  useEffect(() => {
    fetch(backend + "/api/config")
      .then((r) => r.json())
      .then((d) => {
        Beta(!!d.betaLocal);
        if (d.supabase) {
          const c = createClient(d.supabase.url, d.supabase.key);
          C(c);
          c.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") M("newpass");
          });
        }
      })
      .catch(fail);
  }, []);
  async function submit(e) {
    e.preventDefault();
    B(true);
    N("");
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    try {
      let result;
      if (cloud) {
        if (mode === "recover") {
          const r = await cloud.auth.resetPasswordForEmail(b.email, {
            redirectTo: location.origin,
          });
          if (r.error) throw r.error;
          N("Confira seu e-mail.");
          return;
        }
        if (mode === "newpass") {
          const r = await cloud.auth.updateUser({ password: b.password });
          if (r.error) throw r.error;
          M("login");
          return;
        }
        const r =
          mode === "register"
            ? await cloud.auth.signUp({
                email: b.email,
                password: b.password,
                options: { data: { name: b.name } },
              })
            : await cloud.auth.signInWithPassword(b);
        if (r.error) throw r.error;
        if (!r.data.session) {
          N("Confirme o cadastro pelo e-mail.");
          return;
        }
        if (import.meta.env.VITE_USE_AUTH_EDGE === "1") {
          const edge = await cloud.functions.invoke("club-session");
          if (edge.error) throw edge.error;
          result = edge.data;
        } else
          result = await api("cloud", { jwt: r.data.session.access_token });
      } else result = await api(mode, b);
      if (result.recovery) {
        R(result.recovery);
        sessionStorage.pendingMesa = result.token;
      } else session(result.token);
    } catch (e) {
      fail(e);
    } finally {
      B(false);
    }
  }
  return (
    <main className="auth">
      <div className="auth-art">
        <Brand />
        <div>
          <div className="kicker">O SEU CLUBE DE PÔQUER</div>
          <h1>
            A sua mesa.
            <br />
            <em>Suas regras.</em>
          </h1>
        </div>
        <GameHero />
        <small className="hero-note">♠  MONTE SEU CLUBE  ·  REÚNA SEUS AMIGOS  ·  JOGUE</small>
      </div>
      <div className="auth-form">
        {recovery ? (
          <>
            <h2>Guarde seu código</h2>
            <p>
              Ele permite recuperar sua conta local caso você esqueça a senha.
            </p>
            <code>{recovery}</code>
            <button
              className="primary"
              onClick={() => {
                session(sessionStorage.pendingMesa);
                sessionStorage.removeItem("pendingMesa");
              }}
            >
              Guardei, entrar no clube <ArrowRight />
            </button>
          </>
        ) : (
          <>
            <Brand />
            <h2>
              {
                {
                  login: "Entre no clube",
                  register: "Crie sua conta",
                  recover: "Recupere sua conta",
                  newpass: "Nova senha",
                }[mode]
              }
            </h2>
            <p>
              {mode === "register"
                ? "Você começa com 10.000 fichas virtuais."
                : "Acesse suas mesas, fichas e histórico de mãos."}
            </p>
            {sessionStorage.getItem("mesa-invite") && (
              <p className="summary-block">
                Seu convite está guardado. Entre ou crie sua conta para abrir a
                mesa.
              </p>
            )}
            <form onSubmit={submit}>
              {mode === "register" && beta && (
                <Field title="Código do beta">
                  <input required name="beta" />
                </Field>
              )}
              {mode === "register" && (
                <Field title="Apelido">
                  <input name="name" required minLength={2} maxLength={32} />
                </Field>
              )}
              {mode !== "newpass" && (
                <Field title="E-mail">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </Field>
              )}
              {mode === "recover" && !cloud && (
                <Field title="Código de recuperação">
                  <input name="recovery" required />
                </Field>
              )}
              {!(mode === "recover" && cloud) && (
                <Field title={mode === "recover" ? "Nova senha" : "Senha"}>
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </Field>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : {
                      login: "Entrar",
                      register: "Criar conta",
                      recover: "Recuperar acesso",
                      newpass: "Salvar senha",
                    }[mode]}{" "}
                <ArrowRight size={18} />
              </button>
            </form>
            {notice && <p>{notice}</p>}
            <div className="links">
              <button
                onClick={() => M(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Criar uma conta" : "Voltar ao login"}
              </button>
              {mode === "login" && (
                <button onClick={() => M("recover")}>Esqueci a senha</button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
