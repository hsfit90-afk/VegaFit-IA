/**
 * Classifica o equipamento de cada exercício do catálogo, UMA vez, fora da geração.
 *
 * POR QUE OFFLINE, E POR QUE ISSO NÃO FERE O PRINCÍPIO DO PROJETO
 *
 * A regra que seguimos é "enforcement só por prompt falha": a IA nunca decide, na hora de
 * gerar, o que o aluno pode fazer. Isso continua valendo. Aqui ela faz outra coisa — responde
 * uma pergunta de conhecimento geral ("de que equipamento o levantamento terra precisa?"),
 * uma única vez, o resultado é revisado por quem tem CREF, e daí em diante quem filtra é o
 * CÓDIGO, lendo dado conferido.
 *
 * COMO RODAR
 *
 *   node scripts/classificarEquipamento.mjs           # só mostra, não grava
 *   node scripts/classificarEquipamento.mjs --gravar  # grava no banco
 *
 * Precisa de .env.local com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
 * GEMINI_API_KEY.
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const GRAVAR = process.argv.includes('--gravar');

const IDS = ['halteres', 'barra', 'elastico', 'banco', 'barra_fixa', 'kettlebell', 'acessorios', 'maquina'];

/** Quantos exercícios por chamada. 50 cabe folgado na resposta sem truncar. */
const LOTE = 50;

function env() {
  const e = {};
  for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const c = l.indexOf('=');
    if (c < 1 || l.trim().startsWith('#')) continue;
    e[l.slice(0, c).trim()] = l.slice(c + 1).trim().replace(/^["']|["']$/g, '');
  }
  return e;
}

const E = env();
const db = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ai = new GoogleGenAI({ apiKey: E.GEMINI_API_KEY });

const PROMPT = `Você é um profissional de educação física catalogando exercícios.

Para CADA exercício da lista, diga de que equipamento ele precisa para ser executado como o
nome descreve. Use APENAS estes ids:

  halteres    - haltere ou dumbbell
  barra       - barra com anilhas (barra olímpica, barra W, landmine)
  elastico    - elástico, faixa ou banda de resistência
  banco       - banco de supino, banco inclinado, banco scott, ou apoio equivalente
  barra_fixa  - barra fixa, barra de porta, paralelas
  kettlebell  - kettlebell
  acessorios  - bola, rolo de espuma, TRX, argolas, ab wheel, step
  maquina     - QUALQUER aparelho que só existe em academia: polia, cabo, máquina guiada,
                leg press, smith, cadeira extensora, crossover, esteira, bicicleta ergométrica,
                rack de agachamento

REGRAS:
- Lista VAZIA [] significa que o exercício é feito só com o peso do corpo, sem nada.
- Um exercício pode precisar de MAIS DE UM. "Supino inclinado com halteres" = ["banco","halteres"].
- Se o nome não cita o aparelho mas o exercício exige um, inclua mesmo assim. "Levantamento
  Terra" = ["barra"]. "Face Pull" = ["maquina"].
- Na dúvida entre peso corporal e equipamento, escolha o equipamento: errar para menos faz o
  aluno receber um treino mais pobre; errar para mais faz ele receber um exercício que não tem
  como executar.

Responda SOMENTE um JSON, um objeto onde a chave é o nome EXATO do exercício e o valor é o
array de ids. Sem texto antes ou depois.

EXERCÍCIOS:
`;

async function classificarLote(nomes) {
  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: PROMPT + nomes.map(n => `- ${n}`).join('\n'),
    config: { responseMimeType: 'application/json', temperature: 0 },
  });
  const texto = r.text ?? '';
  try {
    return { mapa: JSON.parse(texto), tokens: r.usageMetadata?.totalTokenCount ?? 0 };
  } catch {
    console.error('   resposta não é JSON válido, lote ignorado');
    return { mapa: {}, tokens: r.usageMetadata?.totalTokenCount ?? 0 };
  }
}

const { data: exercicios, error } = await db
  .from('exercises')
  .select('id, name, equipamento_necessario, equipamento_origem')
  .order('name');

if (error) {
  console.error('Não consegui ler o catálogo:', error.message);
  console.error('A coluna existe? Rode database/40_equipamento_do_exercicio.sql primeiro.');
  process.exit(1);
}

// Só o que ainda não foi classificado, para poder rodar de novo sem refazer nem gastar à toa.
const pendentes = exercicios.filter(e => e.equipamento_necessario === null);
console.log(`catálogo: ${exercicios.length} | já classificados: ${exercicios.length - pendentes.length} | pendentes: ${pendentes.length}`);
if (pendentes.length === 0) { console.log('Nada a fazer.'); process.exit(0); }

let tokensTotais = 0;
const resultado = new Map();

for (let i = 0; i < pendentes.length; i += LOTE) {
  const lote = pendentes.slice(i, i + LOTE);
  process.stdout.write(`lote ${Math.floor(i / LOTE) + 1}/${Math.ceil(pendentes.length / LOTE)} (${lote.length})... `);
  const { mapa, tokens } = await classificarLote(lote.map(e => e.name));
  tokensTotais += tokens;

  let ok = 0;
  for (const ex of lote) {
    const bruto = mapa[ex.name];
    if (!Array.isArray(bruto)) continue;
    // Só ids conhecidos: a IA às vezes inventa "corda" ou "colchonete".
    const limpo = [...new Set(bruto.map(String).filter(x => IDS.includes(x)))];
    resultado.set(ex.id, limpo);
    ok++;
  }
  console.log(`${ok} classificados, ${tokens} tokens`);
}

console.log(`\ntotal: ${resultado.size} classificados, ${tokensTotais} tokens`);

// Distribuição, para ver se o resultado faz sentido antes de gravar.
const contagem = {};
for (const ids of resultado.values()) {
  const chave = ids.length === 0 ? '(peso corporal)' : ids.sort().join('+');
  contagem[chave] = (contagem[chave] || 0) + 1;
}
console.log('\nDISTRIBUIÇÃO:');
for (const [k, v] of Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

if (!GRAVAR) {
  console.log('\n(nada foi gravado — rode com --gravar para salvar)');
  process.exit(0);
}

let gravados = 0;
for (const [id, ids] of resultado) {
  const { error: err } = await db
    .from('exercises')
    .update({ equipamento_necessario: ids, equipamento_origem: 'ia' })
    .eq('id', id);
  if (err) console.error(`  falha em ${id}: ${err.message}`);
  else gravados++;
}
console.log(`\ngravados: ${gravados}`);
