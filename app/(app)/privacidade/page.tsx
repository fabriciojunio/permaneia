import { BotaoExportarDados } from "./BotaoExportarDados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus dados" };

export default function PaginaPrivacidade() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl text-tinta-50">Meus dados</h1>
        <p className="mt-2 text-tinta-400">
          O que o PermaneIA guarda sobre você e o que você pode fazer com isso.
        </p>
      </header>

      <section className="painel p-6">
        <h2 className="mb-3 text-lg text-tinta-50">Aviso sobre esta instalação</h2>
        <p className="text-sm leading-relaxed text-tinta-300">
          Esta é uma instalação acadêmica e toda a base é sintética: os alunos, as notas, as frequências e os
          acessos foram gerados por script para demonstrar o funcionamento do sistema. Nenhum registro
          corresponde a uma pessoa real, e nenhum dado de colega de turma foi usado.
        </p>
      </section>

      <section className="painel p-6">
        <h2 className="mb-3 text-lg text-tinta-50">O que é guardado</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-tinta-300">
          <li>
            <span className="text-tinta-100">Conta de acesso:</span> nome, e-mail, papel e a data do último
            acesso. A senha é guardada apenas como hash bcrypt, e não em texto.
          </li>
          <li>
            <span className="text-tinta-100">Dados acadêmicos:</span> frequência, média e número de acessos à
            plataforma por disciplina, além do score de risco calculado a partir deles.
          </li>
          <li>
            <span className="text-tinta-100">Uso do assistente:</span> as perguntas feitas, as respostas
            recebidas e quais trechos de documento foram usados como fonte.
          </li>
          <li>
            <span className="text-tinta-100">Auditoria:</span> registro de quem acessou e alterou o quê, com
            prazo de retenção definido na documentação do projeto.
          </li>
        </ul>
      </section>

      <section className="painel p-6">
        <h2 className="mb-2 text-lg text-tinta-50">Quem vê o seu score de risco</h2>
        <p className="text-sm leading-relaxed text-tinta-300">
          Apenas a coordenação pedagógica. O score não é exibido ao aluno, e essa foi uma decisão deliberada
          de projeto: informar alguém de que um sistema o classificou como risco crítico pode produzir
          justamente o desligamento que o sistema existe para evitar. O score serve para a coordenação
          procurar o aluno, e não para rotulá-lo.
        </p>
      </section>

      <section className="painel p-6">
        <h2 className="mb-3 text-lg text-tinta-50">Acesso e portabilidade</h2>
        <p className="mb-4 text-sm leading-relaxed text-tinta-300">
          Você pode baixar tudo que o sistema guarda sobre você, em formato aberto, a qualquer momento. É o
          direito de acesso e portabilidade previsto no artigo 18 da LGPD.
        </p>
        <BotaoExportarDados />
      </section>
    </div>
  );
}
