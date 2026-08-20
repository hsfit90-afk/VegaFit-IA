"use client";

import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-inter pb-20">
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-outfit font-bold text-white">Política de Privacidade</h1>
        </div>
        <p className="text-xs text-foreground-muted mb-10">Última atualização: 20 de agosto de 2026 — versão 1.0</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground-muted">

          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-foreground">
              <strong className="text-white">Aviso importante:</strong> este documento descreve, de forma transparente, quais dados o VegaFit coleta e como os utiliza — incluindo dados de saúde preenchidos na anamnese. Ele foi escrito para refletir com precisão o funcionamento técnico do app. Antes de publicar esta política para o público, recomendamos revisão por um advogado especializado em proteção de dados (LGPD), especialmente pelos dados de saúde envolvidos.
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">1. Quem somos</h2>
            <p>
              O VegaFit é um aplicativo de geração de treinos com auxílio de inteligência artificial. O responsável pelo tratamento dos dados pessoais descritos nesta política é [RAZÃO SOCIAL / NOME DO RESPONSÁVEL — completar antes de publicar], podendo ser contatado através de [E-MAIL DE CONTATO — completar antes de publicar].
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">2. Quais dados coletamos</h2>
            <p className="mb-3">Coletamos as seguintes categorias de dados:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail, senha (armazenada de forma criptografada), idade, sexo, altura e peso.</li>
              <li>
                <strong className="text-foreground">Dados de saúde (dado sensível, Art. 5º, II da LGPD):</strong> coletados na Anamnese — lesões atuais ou histórico, condições médicas relevantes, uso de medicamentos, liberação médica para treinar, nível de estresse, horas de sono, e, quando aplicável, dados do ciclo hormonal. Também coletamos medidas corporais (cintura, quadril, peso ao longo do tempo) para cálculo de indicadores como a Relação Cintura-Quadril (RCQ).
              </li>
              <li><strong className="text-foreground">Dados de treino:</strong> objetivo, nível de experiência, histórico de treinos realizados, cargas utilizadas, planos gerados e progressão ao longo do tempo.</li>
              <li><strong className="text-foreground">Dados técnicos:</strong> identificador de inscrição para notificações push (quando você ativa lembretes de treino), registros de uso do app para fins de segurança (ex.: limite de uso da geração por IA, para evitar abuso).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">3. Base legal e consentimento</h2>
            <p className="mb-3">
              Para os dados de cadastro e de uso do app, o tratamento se baseia na execução do contrato de uso do serviço (Art. 7º, V da LGPD).
            </p>
            <p>
              Para os <strong className="text-foreground">dados de saúde</strong> preenchidos na Anamnese, por serem dado sensível, o tratamento se baseia no seu <strong className="text-foreground">consentimento explícito</strong> (Art. 11, I da LGPD), coletado especificamente no momento em que você preenche e confirma a Anamnese. Você pode revogar esse consentimento a qualquer momento, conforme descrito na seção 7.
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">4. Para que usamos seus dados</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Gerar planos de treino personalizados, incluindo através de inteligência artificial, considerando seu objetivo, nível, equipamentos disponíveis e, quando existentes, lesões ou condições médicas relatadas — para evitar sugerir exercícios que possam agravar uma condição existente.</li>
              <li>Calcular indicadores de progresso (carga estimada, volume de treino, RCQ) e exibir seu histórico e evolução.</li>
              <li>Enviar notificações de lembrete de treino, quando você ativa essa opção.</li>
              <li>Prevenir abuso e garantir a segurança da plataforma (ex.: limites de geração por dia).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">5. Com quem compartilhamos seus dados</h2>
            <p className="mb-3">Não vendemos seus dados. Compartilhamos dados apenas com prestadores de serviço estritamente necessários para o funcionamento do app:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-foreground">Groq</strong> (provedor de inteligência artificial): ao gerar um treino, enviamos ao Groq as informações necessárias para a geração — incluindo objetivo, nível, equipamentos e, quando existentes, lesões/condições médicas relatadas na Anamnese — para que a IA monte um plano seguro e adequado. O Groq processa essa informação apenas para retornar o plano gerado; recomendamos consultar a política de privacidade do Groq para mais detalhes sobre o tratamento feito por eles.</li>
              <li><strong className="text-foreground">Supabase</strong> (infraestrutura de banco de dados e autenticação): hospeda o banco de dados onde suas informações ficam armazenadas, com controle de acesso restrito por usuário (Row Level Security).</li>
              <li>Se você é aluno de um personal trainer cadastrado na plataforma, seu treinador tem acesso aos seus dados de treino e à sua Anamnese para poder te acompanhar — essa é a finalidade central do vínculo aluno-treinador dentro do app.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">6. Por quanto tempo guardamos seus dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. O histórico de Anamnese é guardado de forma cumulativa (cada nova resposta gera um novo registro, sem apagar os anteriores) para permitir comparar sua evolução ao longo do tempo. Você pode solicitar a exclusão da sua conta e dos dados associados a qualquer momento, conforme a seção 7.
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">7. Seus direitos</h2>
            <p className="mb-3">Nos termos da LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Confirmar a existência de tratamento e acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão dos dados tratados com base no seu consentimento;</li>
              <li>Revogar seu consentimento para o tratamento de dados de saúde a qualquer momento — isso pode limitar a capacidade do app de personalizar seu treino com segurança;</li>
              <li>Solicitar a portabilidade dos seus dados a outro fornecedor de serviço;</li>
              <li>Se opor a tratamentos realizados em desacordo com a lei.</li>
            </ul>
            <p className="mt-3">Para exercer qualquer um desses direitos, entre em contato em [E-MAIL DE CONTATO — completar antes de publicar].</p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">8. Segurança</h2>
            <p>
              Utilizamos controles de acesso a nível de linha no banco de dados (Row Level Security), de forma que cada usuário só acessa seus próprios dados (ou, no caso de treinadores, os dados dos alunos vinculados a eles). A comunicação entre o app e nossos servidores é criptografada (HTTPS). Contas com papel de Master têm acesso administrativo mais amplo, restrito à equipe responsável pela operação da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">9. Menores de idade</h2>
            <p>
              O VegaFit não é direcionado a menores de 18 anos. Caso identifiquemos o cadastro de um menor sem o consentimento verificável de um responsável legal, os dados poderão ser excluídos.
            </p>
          </section>

          <section>
            <h2 className="text-white font-outfit font-semibold text-lg mb-2">10. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas dentro do app antes de entrarem em vigor.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
