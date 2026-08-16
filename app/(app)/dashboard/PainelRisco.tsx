"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { EtiquetaRisco, type Faixa } from "@/components/EtiquetaRisco";
import { formatarNota, formatarNumero, formatarPercentual, formatarDataHora } from "@/lib/formato";

type Linha = {
  matriculaId: string;
  alunoNome: string;
  alunoEmail: string;
  curso: string | null;
  disciplinaNome: string;
  frequenciaPercentual: number;
  mediaNotas: number;
  acessosPlataforma: number;
  scoreRisco: number | null;
  faixaRisco: Faixa | null;
  calculadoEm: string | null;
};

type Detalhe = {
  score: number;
  faixa: Faixa;
  acaoSugerida: string;
  entradas: { engajamentoNormalizado: number };
  regrasDisparadas: Array<{ id: number; forca: number; entao: string; porque: string; destaque: boolean }>;
};

export function PainelRisco({
  linhas,
  total,
  resumo,
  disciplinas,
  disciplinaSelecionada,
}: {
  linhas: Linha[];
  total: number;
  resumo: Record<string, number>;
  disciplinas: Array<{ id: string; nome: string; periodo: string | null }>;
  disciplinaSelecionada: string;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, Detalhe | null>>({});
  const [carregando, setCarregando] = useState<string | null>(null);

  async function alternar(matriculaId: string) {
    if (aberta === matriculaId) {
      setAberta(null);
      return;
    }
    setAberta(matriculaId);

    if (detalhes[matriculaId] !== undefined) return;

    setCarregando(matriculaId);
    try {
      const resposta = await fetch(`/api/matriculas/${matriculaId}`);
      const dados = await resposta.json();
      setDetalhes((atual) => ({ ...atual, [matriculaId]: dados?.matricula?.detalhes ?? null }));
    } catch {
      setDetalhes((atual) => ({ ...atual, [matriculaId]: null }));
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ["critico", "Crítico", "text-risco-critico"],
            ["alto", "Alto", "text-risco-alto"],
            ["medio", "Médio", "text-risco-medio"],
            ["baixo", "Baixo", "text-risco-baixo"],
            ["semCalculo", "Sem cálculo", "text-tinta-400"],
          ] as const
        ).map(([chave, rotulo, cor]) => (
          <div key={chave} className="painel p-4">
            <p className={`font-display text-2xl ${cor}`}>{formatarNumero(resumo[chave] ?? 0)}</p>
            <p className="mt-1 text-xs text-tinta-400">{rotulo}</p>
          </div>
        ))}
      </div>

      <div className="painel p-4">
        <label htmlFor="filtro-disciplina" className="rotulo-campo">
          Filtrar por disciplina
        </label>
        <select
          id="filtro-disciplina"
          value={disciplinaSelecionada}
          onChange={(e) => {
            const valor = e.target.value;
            router.push(valor ? `/dashboard?disciplinaId=${valor}` : "/dashboard");
          }}
          className="campo max-w-md"
        >
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
              {d.periodo ? ` · ${d.periodo}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="painel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              Alunos ordenados por score de risco de evasão, do maior para o menor
            </caption>
            <thead>
              <tr className="border-b border-tinta-700 text-left text-xs uppercase tracking-wide text-tinta-400">
                <th scope="col" className="px-4 py-3 font-medium">Aluno</th>
                <th scope="col" className="px-4 py-3 font-medium">Disciplina</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Frequência</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Média</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Acessos</th>
                <th scope="col" className="px-4 py-3 font-medium">Risco</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-tinta-400">
                    Nenhuma matrícula encontrada. Rode o seed de dados sintéticos para popular a base.
                  </td>
                </tr>
              )}

              {linhas.map((l) => (
                <Fragment key={l.matriculaId}>
                  {/*
                    A linha inteira é o alvo do clique, com role e teclado
                    próprios. Uma versão anterior punha um botão com grid dentro
                    de uma célula de colSpan 6: funcionava no clique, mas as
                    colunas do corpo deixavam de se alinhar com o cabeçalho da
                    tabela, porque eram dois sistemas de layout diferentes.
                  */}
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={aberta === l.matriculaId}
                    onClick={() => alternar(l.matriculaId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        alternar(l.matriculaId);
                      }
                    }}
                    className="cursor-pointer border-b border-tinta-800 transition-colors last:border-0 hover:bg-tinta-800/60"
                  >
                    <td className="max-w-0 px-4 py-3">
                      <span className="block truncate text-tinta-100">{l.alunoNome}</span>
                      <span className="block truncate text-xs text-tinta-500">{l.curso ?? l.alunoEmail}</span>
                    </td>
                    <td className="max-w-0 truncate px-4 py-3 text-tinta-300">{l.disciplinaNome}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-tinta-300">
                      {formatarPercentual(l.frequenciaPercentual, 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-tinta-300">
                      {formatarNota(l.mediaNotas)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-tinta-300">
                      {formatarNumero(l.acessosPlataforma)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <EtiquetaRisco faixa={l.faixaRisco} score={l.scoreRisco} />
                    </td>
                  </tr>

                  {aberta === l.matriculaId && (
                    <tr className="border-b border-tinta-800 last:border-0">
                      <td colSpan={6} className="bg-tinta-900/50 px-4 py-4">
                        {carregando === l.matriculaId && (
                          <p className="text-sm text-tinta-400">Carregando o detalhamento…</p>
                        )}

                        {carregando !== l.matriculaId && !detalhes[l.matriculaId] && (
                          <p className="text-sm text-tinta-400">
                            Esta matrícula ainda não tem detalhamento gravado. Ele é criado no próximo cálculo
                            de risco.
                          </p>
                        )}

                        {detalhes[l.matriculaId] && (
                          <DetalheDoScore detalhe={detalhes[l.matriculaId]!} calculadoEm={l.calculadoEm} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-tinta-500">
        {formatarNumero(linhas.length)} de {formatarNumero(total)} matrícula(s). Dados sintéticos, gerados
        para fins acadêmicos.
      </p>
    </div>
  );
}

function DetalheDoScore({ detalhe, calculadoEm }: { detalhe: Detalhe; calculadoEm: string | null }) {
  // Mostrar as três regras mais fortes, e não todas as que dispararam: a
  // coordenação precisa da explicação, não do log completo da inferência.
  const principais = detalhe.regrasDisparadas.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-permanencia-800 bg-permanencia-950/40 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-permanencia-400">Ação sugerida</p>
        <p className="mt-1 text-sm text-tinta-100">{detalhe.acaoSugerida}</p>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-tinta-400">
          Regras que mais pesaram no score de {Math.round(detalhe.score * 100)}%
        </p>
        <ul className="space-y-2">
          {principais.map((r) => (
            <li key={r.id} className="rounded-md border border-tinta-700 bg-tinta-900/60 p-3">
              <p className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-tinta-500">Regra {r.id}</span>
                <span className="font-mono text-permanencia-400">força {r.forca.toFixed(2)}</span>
                <span className="text-tinta-400">
                  então risco é <span className="text-tinta-200">{r.entao}</span>
                </span>
                {r.destaque && (
                  <span className="etiqueta bg-permanencia-900/60 text-permanencia-300">regra central</span>
                )}
              </p>
              <p className="text-sm leading-relaxed text-tinta-300">{r.porque}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-tinta-500">
        Engajamento normalizado: {detalhe.entradas.engajamentoNormalizado.toFixed(2)} de 10 · Calculado em{" "}
        {formatarDataHora(calculadoEm)}
      </p>
    </div>
  );
}
