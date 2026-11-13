"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validarFuncionario } = require("../validacoes.js");

const valido = {
  nome: "Maria Fictícia",
  bi: "000000001LA001",
  agente: "100001",
  telefone: "923000001",
  escola: "Escola Demo n.º 1",
};

test("aceita dados válidos", () => {
  const r = validarFuncionario(valido);
  assert.equal(r.ok, true);
  assert.deepEqual(r.erros, {});
});

test("rejeita BI fora do formato", () => {
  for (const bi of ["123", "000000001la001", "00000000LA001", "000000001LA0012"]) {
    const r = validarFuncionario({ ...valido, bi });
    assert.equal(r.ok, false, bi);
    assert.ok(r.erros.bi);
  }
});

test("rejeita telefone inválido", () => {
  for (const telefone of ["823000001", "912000001", "92300000", "9230000012"]) {
    assert.ok(validarFuncionario({ ...valido, telefone }).erros.telefone, telefone);
  }
});

test("número de agente tem de ser numérico", () => {
  assert.ok(validarFuncionario({ ...valido, agente: "10A01" }).erros.agente);
  assert.ok(validarFuncionario({ ...valido, agente: "" }).erros.agente);
});

test("nome aceita acentos, hífen e apóstrofo, e rejeita dígitos", () => {
  assert.equal(validarFuncionario({ ...valido, nome: "João D'Ávila-Neto" }).ok, true);
  assert.ok(validarFuncionario({ ...valido, nome: "Maria 2" }).erros.nome);
});

test("escola é obrigatória", () => {
  assert.ok(validarFuncionario({ ...valido, escola: "" }).erros.escola);
});
