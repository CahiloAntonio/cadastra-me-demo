/**
 * Validações do formulário de funcionário (demo).
 * Funciona no navegador (window.Validacoes) e em Node (module.exports).
 */
(function (root) {
  "use strict";

  const RE_NOME = /^[\p{L}][\p{L}\s'’-]*$/u;
  const RE_BI = /^\d{9}[A-Z]{2}\d{3}$/; // 9 dígitos + 2 letras maiúsculas + 3 dígitos
  const RE_AGENTE = /^\d+$/; // apenas dígitos
  const RE_TELEFONE = /^9[2-9]\d{7}$/; // 9 dígitos, começa por 9, 2.º dígito entre 2 e 9

  function validarFuncionario(dados) {
    const erros = {};
    const nome = String(dados.nome || "").trim();
    const bi = String(dados.bi || "").trim();
    const agente = String(dados.agente || "").trim();
    const telefone = String(dados.telefone || "").trim();
    const escola = String(dados.escola || "").trim();

    if (!nome) erros.nome = "Nome obrigatório.";
    else if (!RE_NOME.test(nome)) erros.nome = "Use apenas letras, espaços, hífen ou apóstrofo.";

    if (!RE_BI.test(bi)) erros.bi = "BI inválido. Formato: 9 dígitos + 2 letras maiúsculas + 3 dígitos.";
    if (!agente) erros.agente = "Número de agente obrigatório.";
    else if (!RE_AGENTE.test(agente)) erros.agente = "O número de agente deve ser numérico.";
    if (!RE_TELEFONE.test(telefone)) erros.telefone = "Telefone inválido. 9 dígitos, a começar por 9.";
    if (!escola) erros.escola = "Escolha uma escola.";

    return {
      ok: Object.keys(erros).length === 0,
      erros,
      dados: { nome, bi, agente, telefone, escola },
    };
  }

  const api = { validarFuncionario, RE_NOME, RE_BI, RE_AGENTE, RE_TELEFONE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Validacoes = api;
})(typeof self !== "undefined" ? self : this);
