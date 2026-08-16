"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { avaliarForca } from "@/lib/senha";

const CORES_FORCA = ["bg-risco-critico", "bg-risco-critico", "bg-risco-medio", "bg-risco-baixo", "bg-risco-baixo"];

export function FormularioCadastro({ tamanhoMinimoSenha }: { tamanhoMinimoSenha: number }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [curso, setCurso] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aceite, setAceite] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // A mesma função que o servidor usa para decidir. Aqui ela só dá retorno
  // imediato; a validação que vale é a do servidor.
  const forca = useMemo(() => avaliarForca(senha), [senha]);

  async function cadastrar(evento: React.FormEvent) {
    evento.preventDefault();
    setCampos({});
    setAviso(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/auth/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          curso: curso || undefined,
          senha,
          confirmacao,
          aceiteTermos: aceite,
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setCampos(dados?.erro?.campos ?? {});
        setAviso(dados?.erro?.mensagem ?? "Não foi possível criar a conta.");
        return;
      }

      if (dados.autenticado) {
        router.replace("/inicio");
        router.refresh();
      } else {
        setAviso(dados.mensagem);
      }
    } catch {
      setAviso("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const senhasBatem = confirmacao.length === 0 || senha === confirmacao;
  const podeEnviar =
    nome.trim().length > 0 && email.trim().length > 0 && forca.valida && senha === confirmacao && aceite;

  return (
    <form onSubmit={cadastrar} className="folha space-y-4 p-6" noValidate>
      <div>
        <label htmlFor="nome" className="rotulo-campo">Nome completo</label>
        <input
          id="nome"
          autoComplete="name"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="campo"
          aria-invalid={Boolean(campos.nome)}
        />
        {campos.nome && <p className="mt-1 text-xs text-sagrado-escuro">{campos.nome}</p>}
      </div>

      <div>
        <label htmlFor="email" className="rotulo-campo">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="campo"
          placeholder="voce@unisagrado.edu.br"
          aria-invalid={Boolean(campos.email)}
        />
        {campos.email && <p className="mt-1 text-xs text-sagrado-escuro">{campos.email}</p>}
      </div>

      <div>
        <label htmlFor="curso" className="rotulo-campo">
          Curso <span className="normal-case tracking-normal text-tinta-apagada">(opcional)</span>
        </label>
        <input
          id="curso"
          value={curso}
          onChange={(e) => setCurso(e.target.value)}
          className="campo"
          placeholder="Ciência da Computação"
        />
      </div>

      <div>
        <label htmlFor="senha" className="rotulo-campo">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="campo"
          aria-describedby="forca-senha"
          aria-invalid={Boolean(campos.senha)}
        />

        <div id="forca-senha" className="mt-2">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-[3px] flex-1 ${
                  senha.length > 0 && i < forca.pontuacao ? CORES_FORCA[forca.pontuacao] : "bg-regua"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-tinta-fraca">
            {senha.length === 0
              ? `Pelo menos ${tamanhoMinimoSenha} caracteres, com letra e número.`
              : `Força: ${forca.rotulo}.`}
          </p>
          {senha.length > 0 && forca.problemas.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-risco-alto">
              {forca.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        {campos.senha && <p className="mt-1 text-xs text-sagrado-escuro">{campos.senha}</p>}
      </div>

      <div>
        <label htmlFor="confirmacao" className="rotulo-campo">Confirme a senha</label>
        <input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className="campo"
          aria-invalid={!senhasBatem}
        />
        {!senhasBatem && <p className="mt-1 text-xs text-sagrado-escuro">As senhas não são iguais.</p>}
        {campos.confirmacao && <p className="mt-1 text-xs text-sagrado-escuro">{campos.confirmacao}</p>}
      </div>

      <div className="flex items-start gap-2.5 border border-regua bg-papel p-3">
        <input
          id="aceite"
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-sagrado"
        />
        <label htmlFor="aceite" className="text-xs leading-relaxed text-tinta-media">
          Entendo que esta é uma instalação acadêmica com dados sintéticos, que minhas perguntas ao
          assistente ficam registradas para avaliação do sistema, e que posso baixar ou pedir a
          exclusão dos meus dados a qualquer momento.
        </label>
      </div>
      {campos.aceiteTermos && <p className="text-xs text-sagrado-escuro">{campos.aceiteTermos}</p>}

      {aviso && (
        <p role="alert" className="aviso">
          {aviso}
        </p>
      )}

      <button type="submit" disabled={enviando || !podeEnviar} className="botao-primario w-full">
        {enviando ? "Criando conta" : "Criar conta"}
      </button>
    </form>
  );
}
