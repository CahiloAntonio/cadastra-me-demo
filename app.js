/**
 * Cadastra.me Demo — cadastro offline-first com cifra local e sincronização idempotente.
 * Tudo corre no navegador. O "servidor" é simulado em IndexedDB, com dados fictícios.
 */
"use strict";

/* ---------- IndexedDB ---------- */
const DB_NAME = "cadastrame-demo";
let dbPromise;

function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("chaves", { keyPath: "id" });
      db.createObjectStore("fila", { keyPath: "client_id" });
      db.createObjectStore("recibos", { keyPath: "client_id" });
      db.createObjectStore("funcionarios", { keyPath: "uuid" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const put = (s, v) => tx(s, "readwrite", (o) => o.put(v));
const del = (s, k) => tx(s, "readwrite", (o) => o.delete(k));
const get = (s, k) => tx(s, "readonly", (o) => o.get(k));
const all = (s) => tx(s, "readonly", (o) => o.getAll());
const limpar = (s) => tx(s, "readwrite", (o) => o.clear());

/* ---------- Cifra local (Web Crypto, AES-GCM 256) ---------- */
async function obterChave() {
  let reg = await get("chaves", "aes");
  if (!reg) {
    // Chave não exportável: o JavaScript não consegue ler os bytes da chave.
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    reg = { id: "aes", key };
    await put("chaves", reg);
  }
  return reg.key;
}

async function cifrar(objeto) {
  const key = await obterChave();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new TextEncoder().encode(JSON.stringify(objeto));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dados);
  return { iv, ct };
}

async function decifrar(payload) {
  const key = await obterChave();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.iv }, key, payload.ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

async function sha256(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const canonico = (d) => JSON.stringify(d, Object.keys(d).sort());
const hexCurto = (buf, n = 12) =>
  [...new Uint8Array(buf).slice(0, n)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ---------- Servidor simulado ---------- */
let perderConfirmacao = false; // simula resposta perdida depois de o servidor gravar

async function servidorReceber(pacote) {
  await new Promise((r) => setTimeout(r, 250)); // latência simulada
  const recibo = await get("recibos", pacote.client_id);

  if (recibo) {
    if (recibo.payload_hash !== pacote.payload_hash) {
      return { status: 422, mensagem: "client_id reutilizado com dados diferentes." };
    }
    if (recibo.estado === "processado") {
      return { status: 200, mensagem: "Pacote já processado (idempotente).", uuid: recibo.resultado.uuid };
    }
  }

  const v = Validacoes.validarFuncionario(pacote.dados);
  if (!v.ok) return { status: 422, mensagem: "Validação falhou no servidor: " + Object.values(v.erros)[0] };

  const existentes = await all("funcionarios");
  const mesmo = existentes.find((f) => f.bi === v.dados.bi && f.agente === v.dados.agente);
  if (mesmo) {
    // A confirmação anterior perdeu-se: reconhece o mesmo cadastro em vez de criar conflito.
    await put("recibos", {
      client_id: pacote.client_id,
      payload_hash: pacote.payload_hash,
      estado: "processado",
      resultado: { uuid: mesmo.uuid },
    });
    return { status: 200, mensagem: "Cadastro já existia; recibo reconciliado.", uuid: mesmo.uuid };
  }
  const duplicado = existentes.find((f) => f.bi === v.dados.bi || f.agente === v.dados.agente);
  if (duplicado) {
    return { status: 409, mensagem: "Conflito: BI ou número de agente já pertence a outro funcionário." };
  }

  const uuid = crypto.randomUUID();
  await put("funcionarios", { uuid, ...v.dados, criado_em: new Date().toISOString() });
  await put("recibos", {
    client_id: pacote.client_id,
    payload_hash: pacote.payload_hash,
    estado: "processado",
    resultado: { uuid },
  });

  if (perderConfirmacao) {
    perderConfirmacao = false;
    document.getElementById("perder").checked = false;
    throw new Error("Rede caiu antes da confirmação chegar ao cliente.");
  }
  return { status: 201, mensagem: "Funcionário criado.", uuid };
}

/* ---------- Estado e utilitários de interface ---------- */
let offline = false;
let aSincronizar = false;
let contador = 1;

const $ = (id) => document.getElementById(id);

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function log(texto, tipo = "info") {
  const linha = el("li", "log-" + tipo);
  const hora = new Date().toLocaleTimeString("pt-PT");
  linha.textContent = `[${hora}] ${texto}`;
  const lista = $("log");
  lista.prepend(linha);
  while (lista.children.length > 60) lista.lastChild.remove();
}

const mascararBI = (bi) => bi.slice(0, 3) + "••••••" + bi.slice(-5);

async function desenhar() {
  // Fila local
  const fila = (await all("fila")).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const ul = $("fila");
  ul.replaceChildren();
  for (const item of fila) {
    const dados = await decifrar(item.payload);
    const li = el("li", "item");
    const topo = el("div", "item-topo");
    topo.append(el("strong", null, dados.nome), el("span", "badge badge-" + item.estado, item.estado));
    li.append(topo);
    li.append(el("div", "mono", "client_id " + item.client_id.slice(0, 8) + "…"));
    li.append(el("div", "mono cifra", "AES-GCM: " + hexCurto(item.payload.ct) + "…"));
    if (item.mensagem) li.append(el("div", "msg", item.mensagem));
    ul.append(li);
  }
  $("fila-vazia").hidden = fila.length > 0;
  $("contador-fila").textContent = String(fila.length);

  // Base de dados do "servidor"
  const funcs = (await all("funcionarios")).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const tb = $("tabela-servidor");
  tb.replaceChildren();
  for (const f of funcs) {
    const tr = el("tr");
    tr.append(el("td", "mono", f.uuid.slice(0, 8)), el("td", null, f.nome), el("td", "mono", mascararBI(f.bi)), el("td", null, f.escola));
    tb.append(tr);
  }
  $("servidor-vazio").hidden = funcs.length > 0;
  $("contador-servidor").textContent = String(funcs.length);

  const estado = $("estado-rede");
  estado.textContent = offline ? "Offline" : "Online";
  estado.className = "badge " + (offline ? "badge-error" : "badge-ok");
}

function mostrarErros(erros) {
  for (const campo of ["nome", "bi", "agente", "telefone", "escola"]) {
    const alvo = $("erro-" + campo);
    alvo.textContent = erros[campo] || "";
    $(campo).setAttribute("aria-invalid", erros[campo] ? "true" : "false");
  }
}

/* ---------- Cadastro e sincronização ---------- */
async function cadastrar(evento) {
  evento.preventDefault();
  const bruto = Object.fromEntries(new FormData($("form")).entries());
  const v = Validacoes.validarFuncionario(bruto);
  mostrarErros(v.erros);
  if (!v.ok) {
    log("Cadastro recusado no navegador: dados inválidos.", "erro");
    return;
  }

  // Impede duas pendências com o mesmo BI e número de agente no mesmo aparelho.
  for (const item of await all("fila")) {
    const d = await decifrar(item.payload);
    if (d.bi === v.dados.bi && d.agente === v.dados.agente) {
      log("Já existe uma pendência com este BI e número de agente neste aparelho.", "erro");
      return;
    }
  }

  const client_id = crypto.randomUUID();
  const payload_hash = await sha256(canonico(v.dados));
  const payload = await cifrar(v.dados); // só dados cifrados entram na fila
  await put("fila", { client_id, payload_hash, payload, estado: "pending", criado_em: new Date().toISOString() });
  log(`Cadastro de "${v.dados.nome}" guardado e cifrado localmente (client_id ${client_id.slice(0, 8)}…).`, "ok");
  $("form").reset();
  mostrarErros({});
  await desenhar();
  if (!offline) sincronizar();
}

async function sincronizar() {
  if (aSincronizar) return;
  if (offline) {
    log("Sem rede: a fila fica guardada no aparelho.", "aviso");
    return;
  }
  aSincronizar = true;
  try {
    const pendentes = (await all("fila"))
      .filter((i) => i.estado === "pending" || i.estado === "syncing")
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    for (const item of pendentes) {
      item.estado = "syncing";
      await put("fila", item);
      await desenhar();
      try {
        const dados = await decifrar(item.payload);
        const resp = await servidorReceber({ client_id: item.client_id, payload_hash: item.payload_hash, dados });
        if (resp.status === 200 || resp.status === 201) {
          await del("fila", item.client_id);
          log(`${resp.status} — ${resp.mensagem}`, "ok");
        } else {
          item.estado = resp.status === 409 ? "conflict" : "error";
          item.mensagem = resp.mensagem;
          await put("fila", item);
          log(`${resp.status} — ${resp.mensagem}`, "erro");
        }
      } catch (e) {
        item.estado = "pending";
        await put("fila", item);
        log("Falha de rede: " + e.message + " Será reenviado com o mesmo client_id.", "aviso");
        break;
      }
    }
  } finally {
    aSincronizar = false;
    await desenhar();
  }
}

/* ---------- Ações da interface ---------- */
function preencherExemplo() {
  const n = String(contador).padStart(3, "0");
  const f = $("form");
  f.nome.value = `Funcionário Fictício ${["Alfa", "Beta", "Gama", "Delta", "Épsilon"][(contador - 1) % 5]}`;
  f.bi.value = `000000${n}LA${n}`;
  f.agente.value = String(100000 + contador);
  f.telefone.value = `923${String(contador).padStart(6, "0")}`;
  f.escola.value = f.escola.options[1 + ((contador - 1) % (f.escola.options.length - 1))].value;
  contador += 1;
  mostrarErros({});
}

async function repor() {
  for (const s of ["fila", "recibos", "funcionarios"]) await limpar(s);
  contador = 1;
  log("Demo reposta: fila, recibos e base do servidor limpos.", "info");
  await desenhar();
}

function alternarRede(valor) {
  offline = valor;
  log(offline ? "Modo offline ativado." : "Rede restabelecida.", offline ? "aviso" : "ok");
  desenhar();
  if (!offline) sincronizar();
}

document.addEventListener("DOMContentLoaded", async () => {
  $("form").addEventListener("submit", cadastrar);
  $("btn-exemplo").addEventListener("click", preencherExemplo);
  $("btn-sync").addEventListener("click", sincronizar);
  $("btn-repor").addEventListener("click", repor);
  $("offline").addEventListener("change", (e) => alternarRede(e.target.checked));
  $("perder").addEventListener("change", (e) => {
    perderConfirmacao = e.target.checked;
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => log("Service Worker indisponível neste contexto.", "aviso"));
  }
  log("Demo pronta. Use dados fictícios; nada sai do seu navegador.", "info");
  await desenhar();
});
