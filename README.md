<h1 align="center">Cadastra.me Demo</h1>

<p align="center">
  Demonstração pública de <b>cadastro offline-first</b>, <b>cifra local</b> e <b>sincronização idempotente</b>, inspirada no projeto Cadastra.me.
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white">
  <img alt="Web Crypto" src="https://img.shields.io/badge/Web_Crypto-AES--GCM_256-0b5fff?style=for-the-badge">
  <img alt="Licença" src="https://img.shields.io/badge/licen%C3%A7a-MIT-green?style=for-the-badge">
</p>

---

## Sobre

Em zonas com pouca ou nenhuma internet, perder um cadastro ou duplicá-lo ao reenviar é um problema real. Esta demo mostra, numa página simples, sem dependências nem etapa de build, como resolver isso no navegador:

1. O utilizador regista um funcionário, **mesmo sem rede**.
2. Os dados são **cifrados** (AES-GCM de 256 bits) antes de entrarem na fila local (IndexedDB).
3. Quando a rede volta, a fila é enviada para um servidor simulado.
4. O servidor usa recibos por `client_id` e `payload_hash`, por isso **reenvios nunca criam duplicados**.

> **Aviso:** é um projeto de demonstração, escrito de raiz. **Não contém código, dados ou documentos de nenhum cliente.** Todos os nomes, BI, telefones e escolas são fictícios e ficam apenas no seu navegador.

## O que a demo mostra

| Conceito | Como aparece na demo |
|---|---|
| Validação partilhada | BI, nº de agente, telefone e nome validados no navegador e no "servidor" com o mesmo módulo (`validacoes.js`) |
| Fila offline | Botão **Modo offline** guarda os cadastros localmente até haver rede |
| Cifra local | A fila mostra o texto cifrado (AES-GCM) em vez dos dados; a chave é **não exportável** |
| Idempotência | Reenviar o mesmo pacote devolve `200` em vez de criar outro registo |
| Confirmação perdida | **Perder a confirmação (1×)** simula uma queda depois de o servidor gravar; o reenvio é reconciliado |
| Conflitos | BI ou nº de agente repetido noutro funcionário devolve `409` e marca a pendência como `conflict` |
| PWA | Service Worker com cache do shell; instalável e utilizável sem rede |

## Como experimentar

Não precisa de instalar nada. Abra `index.html` num navegador moderno. Para testar o Service Worker e a instalação PWA, sirva a pasta por HTTP:

```bash
npx serve .
# ou
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

**Roteiro sugerido:**

1. Clique em **Preencher exemplo** e depois em **Cadastrar** (online: sincroniza logo).
2. Ative **Modo offline**, cadastre mais dois funcionários e veja a fila cifrada.
3. Desative o modo offline: a fila é enviada por ordem.
4. Ative **Perder a confirmação (1×)** e cadastre: o servidor grava, a resposta perde-se, e o reenvio é reconhecido sem duplicar.

## Testes

Os testes das validações usam o runner nativo do Node.js (18 ou superior), sem dependências:

```bash
node --test
```

## Estrutura

```text
.
├── index.html            Interface
├── style.css             Estilos (modo claro e escuro)
├── app.js                IndexedDB, cifra AES-GCM, fila, sincronização e servidor simulado
├── validacoes.js         Regras de validação (navegador e Node)
├── sw.js                 Service Worker (cache do shell)
├── manifest.webmanifest  Metadados PWA
├── icon.svg              Ícone
└── tests/                Testes das validações
```

## Limitações

- O "servidor" é simulado no próprio navegador; serve para demonstrar o protocolo, não para produção.
- Os dados ficam no armazenamento do navegador. Limpar os dados do site apaga tudo, incluindo a chave de cifra.
- A cifra local protege os dados em repouso no aparelho, mas não substitui autenticação nem HTTPS num sistema real.

## Autor

**Cahilo Antonio** · [@CahiloAntonio](https://github.com/CahiloAntonio) · Antonio-Dev · Angola

## Licença

[MIT](LICENSE)
