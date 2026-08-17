import { BotaoExportarDados } from "./BotaoExportarDados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus dados" };

const GUARDADO = [
  ["Conta de acesso", "Nome, e-mail, papel e data do último acesso. A senha é guardada apenas como hash bcrypt, e não em texto."],
  ["Dados acadêmicos", "Frequência, média e número de acessos à plataforma por disciplina, além do score de risco calculado a partir deles."],
  ["Uso do assistente", "As perguntas feitas, as respostas recebidas e quais trechos de documento foram usados como fonte."],
  ["Auditoria", "Registro de quem acessou e alterou o quê, com prazo de retenção definido na documentação do projeto."],
];

export default function PaginaPrivacidade() {
  return (
    <div>
      <div className="grade border-b border-regua pb-6">
        <div className="margem">
          <p className="carimbo">Tratamento de dados</p>
        </div>
        <div>
          <h1 className="font-display text-3xl text-tinta">Meus dados</h1>
          <p className="aviso mt-3 max-w-[38rem]">
            Esta é uma instalação acadêmica e toda a base é sintética: os alunos, as notas, as
            frequências e os acessos foram gerados por script. Nenhum registro corresponde a uma
            pessoa real, e nenhum dado de colega de turma foi usado.
          </p>
        </div>
      </div>

      <section className="grade border-b border-regua py-8" aria-labelledby="guardado">
        <div className="margem">
          <p className="margem-numero">1</p>
          <p className="carimbo mt-1">O que é guardado</p>
        </div>
        <table className="w-full max-w-[38rem] text-left">
          <caption className="sr-only" id="guardado">
            O que é guardado
          </caption>
          <tbody>
            {GUARDADO.map(([titulo, texto]) => (
              <tr key={titulo} className="border-b border-regua-fraca align-baseline">
                <th scope="row" className="w-44 py-3 pr-6 font-sans text-[15px] font-semibold text-tinta">
                  {titulo}
                </th>
                <td className="py-3 text-[14px] leading-relaxed text-tinta-media">{texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grade border-b border-regua py-8" aria-labelledby="score">
        <div className="margem">
          <p className="margem-numero">2</p>
          <p className="carimbo mt-1">Quem vê o score</p>
        </div>
        <p className="max-w-[38rem] text-[15px] leading-[1.7] text-tinta-media">
          <span id="score" className="sr-only">Quem vê o seu score de risco</span>
          Apenas a coordenação pedagógica. O score não é exibido ao aluno, e essa foi uma decisão
          deliberada de projeto: informar alguém de que um sistema o classificou como risco crítico
          pode produzir justamente o desligamento que o sistema existe para evitar. O score serve
          para a coordenação procurar o aluno, e não para rotulá-lo.
        </p>
      </section>

      <section className="grade py-8" aria-labelledby="acesso">
        <div className="margem">
          <p className="margem-numero">3</p>
          <p className="carimbo mt-1" id="acesso">Acesso e portabilidade</p>
        </div>
        <div>
        <p className="mb-4 max-w-[38rem] text-[15px] leading-[1.7] text-tinta-media">
          Você pode baixar tudo que o sistema guarda sobre você, em formato aberto, a qualquer
          momento. É o direito de acesso e portabilidade previsto no artigo 18 da LGPD.
        </p>
        <BotaoExportarDados />
        </div>
      </section>
    </div>
  );
}
