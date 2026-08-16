export interface AnamneseField {
  id: string;
  type: 'text' | 'number' | 'textarea' | 'chips-single' | 'chips-multi' | 'slider' | 'rcq-result';
  label: string;
  placeholder?: string;
  options?: string[];
  optional?: boolean;
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;
  defaultValue?: number;
  hint?: string;
}

export interface AnamneseStep {
  id: string;
  title: string;
  sub: string;
  condition?: (answers: Record<string, any>) => boolean;
  fields: AnamneseField[];
}

export const anamneseSteps: AnamneseStep[] = [
  {
    id: "gerais",
    title: "Dados gerais",
    sub: "Vamos começar com o básico sobre você.",
    fields: [
      { id: "nome", type: "text", label: "Nome completo", placeholder: "Seu nome" },
      { id: "idade", type: "number", label: "Idade", placeholder: "Ex: 29" },
      { id: "sexo", type: "chips-single", label: "Sexo biológico", options: ["Masculino", "Feminino"] },
      { id: "altura", type: "number", label: "Altura (cm)", placeholder: "Ex: 170" },
      { id: "peso", type: "number", label: "Peso atual (kg)", placeholder: "Ex: 70" }
    ]
  },
  {
    id: "objetivo",
    title: "Seu objetivo",
    sub: "O que te trouxe até aqui.",
    fields: [
      { id: "objetivo", type: "chips-multi", label: "Objetivo principal", options: ["Hipertrofia", "Emagrecimento", "Performance", "Saúde geral", "Definição muscular"] },
      { id: "prazo", type: "text", label: "Tem algum prazo ou evento específico?", placeholder: "Ex: Casamento em dezembro (opcional)", optional: true }
    ]
  },
  {
    id: "historico",
    title: "Histórico de treino",
    sub: "Sua experiência até aqui.",
    fields: [
      { id: "nivel", type: "chips-single", label: "Nível de treino", options: ["Iniciante", "Intermediário", "Avançado"] },
      { id: "frequencia", type: "chips-single", label: "Frequência semanal atual", options: ["1-2x", "3x", "4x", "5x", "6x+"] },
      { id: "tempo_sessao", type: "chips-single", label: "Tempo disponível por sessão", options: ["30 min", "45 min", "60 min", "90 min+"] },
      { id: "parou", type: "chips-single", label: "Parou de treinar recentemente por algum período?", options: ["Sim", "Não"] },
      { id: "cargas", type: "textarea", label: "Cargas atuais nos exercícios básicos (se souber)", placeholder: "Ex: Agachamento 60kg, Supino 40kg, Terra 70kg", optional: true }
    ]
  },
  {
    id: "saude",
    title: "Saúde e limitações",
    sub: "Informações importantes para treinar com segurança.",
    fields: [
      { id: "lesoes", type: "textarea", label: "Lesões atuais ou histórico (ombro, joelho, lombar...)", placeholder: "Ex: Dor leve no ombro direito ao elevar o braço", optional: true },
      { id: "condicoes", type: "textarea", label: "Condições médicas relevantes", placeholder: "Ex: Hipertensão controlada", optional: true },
      { id: "medicamentos", type: "text", label: "Usa medicamentos contínuos?", placeholder: "Ex: Losartana (ou 'não')", optional: true },
      { id: "liberacao", type: "chips-single", label: "Possui liberação médica para treinar?", options: ["Sim", "Não", "Não verifiquei"] }
    ]
  },
  {
    id: "rotina",
    title: "Rotina e recuperação",
    sub: "O que acontece fora do treino também importa.",
    fields: [
      { id: "sono", type: "chips-single", label: "Quantas horas você dorme por noite, em média?", options: ["Menos de 5h", "5-6h", "6-7h", "7-8h", "8h ou mais"] },
      { id: "estresse", type: "slider", label: "Nível de estresse no dia a dia", min: 0, max: 10, min_label: "Tranquilo", max_label: "Muito estressado", defaultValue: 5 },
      { id: "profissao", type: "chips-single", label: "Rotina de trabalho", options: ["Sedentária", "Moderadamente ativa", "Fisicamente ativa"] }
    ]
  },
  {
    id: "estrutura",
    title: "Estrutura disponível",
    sub: "Onde e como você vai treinar.",
    fields: [
      { id: "local", type: "chips-single", label: "Local de treino", options: ["Academia completa", "Casa com equipamentos", "Casa sem equipamentos", "Ar livre / parque"] },
      { id: "equipamentos", type: "textarea", label: "Equipamentos disponíveis (se treina em casa)", placeholder: "Ex: Halteres até 20kg, elástico", optional: true },
      { id: "dias", type: "text", label: "Dias e horários fixos possíveis", placeholder: "Ex: Seg, qua e sex às 7h" }
    ]
  },
  {
    id: "nutricao",
    title: "Nutrição",
    sub: "Um panorama rápido da sua alimentação.",
    fields: [
      { id: "nutricionista", type: "chips-single", label: "Acompanha com nutricionista atualmente?", options: ["Sim", "Não"] },
      { id: "refeicoes", type: "chips-single", label: "Número de refeições por dia", options: ["2-3", "4", "5", "6+"] },
      { id: "restricoes", type: "text", label: "Restrições alimentares ou alergias", placeholder: "Ex: Intolerância à lactose (ou 'nenhuma')", optional: true },
      { id: "suplementos", type: "text", label: "Suplementação atual", placeholder: "Ex: Whey e creatina (ou 'nenhuma')", optional: true }
    ]
  },
  {
    id: "mulheres",
    title: "Ciclo hormonal",
    sub: "Ajuda a ajustar carga e volume nas semanas do ciclo.",
    condition: (answers: any) => answers.sexo === "Feminino",
    fields: [
      { id: "ciclo_regular", type: "chips-single", label: "Ciclo menstrual regular?", options: ["Sim", "Não", "Não sei"] },
      { id: "anticoncepcional", type: "text", label: "Usa anticoncepcional? Qual tipo (se souber)", placeholder: "Ex: Pílula combinada (ou 'não uso')", optional: true },
      { id: "tpm", type: "textarea", label: "Sintomas de TPM que afetam sua energia ou desempenho", placeholder: "Ex: Fadiga e inchaço nos 3 dias antes", optional: true },
      { id: "fase_ciclo", type: "chips-single", label: "Em que fase do ciclo você está agora?", options: ["Menstrual", "Folicular", "Ovulatória", "Lútea", "Não sei"] }
    ]
  },
  {
    id: "medidas",
    title: "Medidas iniciais",
    sub: "Sua referência da semana 0 para calcular a Relação Cintura-Quadril (RCQ).",
    fields: [
      { id: "cintura", type: "number", label: "Cintura (cm)", placeholder: "Ex: 74", hint: "Meça no ponto médio entre a última costela e o osso do quadril" },
      { id: "quadril", type: "number", label: "Quadril (cm)", placeholder: "Ex: 98", hint: "Meça no ponto de maior circunferência dos glúteos" },
      { id: "rcq", type: "rcq-result", label: "Sua RCQ" }
    ]
  },
  {
    id: "expectativas",
    title: "Comunicação",
    sub: "Últimas perguntas antes de montarmos seu treino.",
    fields: [
      { id: "comunicacao", type: "chips-single", label: "Como prefere reportar feedback?", options: ["WhatsApp", "E-mail", "Planilha"] },
      { id: "checkin", type: "chips-single", label: "Frequência de check-in desejada", options: ["Semanal", "Quinzenal"] },
      { id: "viagem", type: "text", label: "Alguma viagem ou período que pode interromper o ciclo?", placeholder: "Ex: Viagem na semana 5 (ou 'nenhum')", optional: true }
    ]
  }
];
