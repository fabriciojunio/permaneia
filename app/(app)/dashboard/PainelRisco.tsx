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

const RESUMO = [
  ["critico", "Crítico", "text-risco-critico"],
  ["alto", "Alto", "text-risco-alto"],
  ["medio", "Médio", "text-risco-medio"],
  ["baixo", "Baixo", "text-risco-baixo"],
  ["semCalculo", "Sem cálculo", "text-tinta-fraca"],
] as const;

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
    <div className="space-y-6">
      <section>
        <h2 className="carimbo mb-2">Distribuição</h2>
        <div className="flex flex-wrap divide-x divide-regua border border-regua bg-papel-alto">
          {RESUMO.map(([chave, rotulo, cor]) => (
            <div key={chave} className="flex-1 px-4 py-3">
              <p className={`font-mono text-2xl font-bold ${cor}`}>{formatarNumero(resumo[chave] ?? 0)}</p>
              <p className="carimbo mt-0.5">{rotulo}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="nao-imprime">
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

      <div className="folha overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] table-fixed text-sm">
            <caption className="sr-only">
              Alunos ordenados por score de risco de evasão, do maior para o menor
            </caption>
            {/* Larguras fixas: com layout automático a tabela mudava de forma a
                cada filtro aplicado. */}
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[24%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-tinta text-left">
                <th scope="col" className="carimbo px-4 py-2">Aluno</th>
                <th scope="col" className="carimbo px-4 py-2">Disciplina</th>
                <th scope="col" className="carimbo px-4 py-2 text-right">Frequência</th>
                <th scope="col" className="carimbo px-4 py-2 text-right">Média</th>
                <th scope="col" className="carimbo px-4 py-2 text-right">Acessos</th>
                <th scope="col" className="carimbo px-4 py-2">Risco</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-tinta-fraca">
                    Nenhuma matrícula encontrada. Rode o seed de dados sintéticos para popular a base.
                  </td>
                </tr>
              )}

              {linhas.map((l) => (
                <Fragment key={l.matriculaId}>
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
                    className="cursor-pointer border-b border-regua-fraca transition-colors last:border-0 hover:bg-papel"
                  >
                    <td className="px-4 py-2.5">
                      <span className="block truncate text-tinta">{l.alunoNome}</span>
                      <span className="block truncate text-xs text-tinta-fraca">
                        {l.curso ?? l.alunoEmail}
                      </span>
                    </td>
                    <td className="truncate px-4 py-2.5 text-tinta-media">{l.disciplinaNome}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-tinta">
                      {formatarPercentual(l.frequenciaPercentual, 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-tinta">
                      {formatarNota(l.mediaNotas)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-tinta">
                      {formatarNumero(l.acessosPlataforma)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <EtiquetaRisco faixa={l.faixaRisco} score={l.scoreRisco} />
                    </td>
                  </tr>

                  {aberta === l.matriculaId && (
                    <tr className="border-b border-regua last:border-0">
                      <td colSpan={6} className="bg-papel px-4 py-4">
                        {carregando === l.matriculaId && (
                          <p className="text-sm text-tinta-fraca">Carregando o detalhamento…</p>
                        )}

                        {carregando !== l.matriculaId && !detalhes[l.matriculaId] && (
                          <p className="text-sm text-tinta-fraca">
                            Esta matrícula ainda não tem detalhamento gravado. Ele é criado no
                            próximo cálculo de risco.
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

      <p className="text-xs text-tinta-fraca">
        {formatarNumero(linhas.length)} de {formatarNumero(total)} matrícula(s). Dados sintéticos,
        gerados para fins acadêmicos.
      </p>
    </div>
  );
}

function DetalheDoScore({ detalhe, calculadoEm }: { detalhe: Detalhe; calculadoEm: string | null }) {
  // Três regras, e não todas: a coordenação precisa da explicação, não do log
  // completo da inferência.
  const principais = detalhe.regrasDisparadas.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="aviso">
        <p className="carimbo mb-1 text-sagrado">Ação sugerida</p>
        <p className="text-[15px]">{detalhe.acaoSugerida}</p>
      </div>

      <div>
        <p className="carimbo mb-2">
          Regras que mais pesaram no score de {Math.round(detalhe.score * 100)}%
        </p>
        <ol className="space-y-2">
          {principais.map((r) => (
            <li key={r.id} className="border-l-2 border-regua-forte pl-3">
              <p className="mb-0.5 flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] text-tinta-fraca">
                <span>regra {r.id}</span>
                <span className="text-tinta">força {r.forca.toFixed(2)}</span>
                <span>então risco é {r.entao}</span>
                {r.destaque && <span className="text-sagrado">regra central</span>}
              </p>
              <p className="text-[14px] leading-relaxed text-tinta-media">{r.porque}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-tinta-fraca">
        Engajamento normalizado: {detalhe.entradas.engajamentoNormalizado.toFixed(2)} de 10 ·
        Calculado em {formatarDataHora(calculadoEm)}
      </p>
    </div>
  );
}
