import { Exercise } from './types';

export const exercisesDB: Exercise[] = [
  // Peito
  {
    id: 'chest-1',
    name: 'Supino Reto com Barra',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Tríceps', 'Ombro'],
    equipment: 'Barra',
    difficulty: 2,
    youtubeId: 'sqOw2Y6uDWQ', 
    instructions: [
      'Deite no banco com os olhos alinhados à barra.',
      'Pegue a barra com as mãos um pouco mais largas que os ombros.',
      'Desça a barra controladamente até tocar o meio do peito.',
      'Empurre a barra de volta à posição inicial.'
    ],
    commonMistakes: ['Levantar o quadril do banco.', 'Descer a barra no pescoço.', 'Não retrair as escápulas.'],
    variations: ['Supino Reto com Halteres', 'Supino Máquina']
  },
  {
    id: 'chest-2',
    name: 'Supino Inclinado com Halteres',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Tríceps', 'Ombro'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: '0G_ckBq8T_w',
    instructions: [
      'Ajuste o banco para 30-45 graus de inclinação.',
      'Segure os halteres acima do peito com os braços estendidos.',
      'Desça os halteres controladamente até a altura do peito.',
      'Empurre os halteres para cima e junte-os levemente no topo.'
    ],
    commonMistakes: ['Inclinação muito alta (foca muito no ombro).', 'Descer os halteres muito abertos.'],
    variations: ['Supino Inclinado com Barra', 'Crucifixo Inclinado']
  },
  {
    id: 'chest-3',
    name: 'Crucifixo na Máquina (Peck Deck)',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Ombro'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'eGjt4jcWAjY',
    instructions: [
      'Ajuste o assento para que os puxadores fiquem na altura do peito.',
      'Mantenha os cotovelos levemente flexionados.',
      'Feche os braços até as mãos se encontrarem à frente do corpo.',
      'Retorne controladamente sentindo o alongamento do peito.'
    ],
    commonMistakes: ['Esticar totalmente os braços.', 'Usar impulso do corpo.'],
    variations: ['Crucifixo com Halteres', 'Crossover em Polia Média']
  },
  {
    id: 'chest-4',
    name: 'Crossover (Polia Alta)',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Ombro'],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: 'taI4XduLpTk',
    instructions: [
      'Ajuste as polias na posição mais alta.',
      'Dê um passo à frente e incline levemente o tronco.',
      'Puxe os cabos para baixo e para frente, cruzando levemente as mãos no final.',
      'Retorne controladamente.'
    ],
    commonMistakes: ['Fazer movimento de supino em vez de crucifixo.', 'Usar muito peso e perder a postura.'],
    variations: ['Crossover Polia Baixa', 'Crossover Polia Média']
  },
  {
    id: 'chest-5',
    name: 'Flexão de Braços',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Tríceps', 'Ombro', 'Core/Abdômen'],
    equipment: 'Sem equipamento',
    difficulty: 1,
    youtubeId: 'c8P0hR2p_hE',
    instructions: [
      'Posição de prancha, mãos na largura dos ombros.',
      'Mantenha o corpo reto.',
      'Desça até o peito quase tocar o chão.',
      'Empurre de volta à posição inicial.'
    ],
    commonMistakes: ['Deixar o quadril cair.', 'Cotovelos muito abertos (90 graus).'],
    variations: ['Flexão com Joelhos', 'Flexão Inclinada', 'Flexão Declinada']
  },

  // Costas
  {
    id: 'back-1',
    name: 'Puxada Alta (Pulldown)',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'EUIri47Epcg',
    instructions: [
      'Sente-se e ajuste as travas para os joelhos.',
      'Segure a barra um pouco mais largo que os ombros.',
      'Puxe a barra em direção ao peito, deprimindo as escápulas.',
      'Estenda os braços controladamente.'
    ],
    commonMistakes: ['Puxar a barra atrás da nuca.', 'Usar muito impulso lombar.'],
    variations: ['Puxada Supinada', 'Puxada com Triângulo']
  },
  {
    id: 'back-2',
    name: 'Remada Curvada com Barra',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps', 'Posterior de coxa'],
    equipment: 'Barra',
    difficulty: 3,
    youtubeId: 'G8l_8chR5BE',
    instructions: [
      'Segure a barra e incline o tronco à frente (quase paralelo ao chão).',
      'Mantenha a coluna neutra e core contraído.',
      'Puxe a barra em direção ao umbigo.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Curvar a lombar (arredondar as costas).', 'Ficar muito em pé e fazer encolhimento.'],
    variations: ['Remada Curvada Supinada', 'Remada Cavalinho']
  },
  {
    id: 'back-3',
    name: 'Remada Sentada (Polia Baixa)',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Cabo',
    difficulty: 1,
    youtubeId: 'GZbfZ033f74',
    instructions: [
      'Sente-se com os joelhos levemente flexionados.',
      'Segure o puxador (geralmente triângulo) e mantenha a coluna reta.',
      'Puxe em direção ao abdômen, apertando as escápulas.',
      'Volte sem deixar o peso curvar suas costas para frente.'
    ],
    commonMistakes: ['Balançar o tronco para trás (impulso).', 'Não retrair as escápulas no final do movimento.'],
    variations: ['Remada Unilateral na Polia']
  },
  {
    id: 'back-4',
    name: 'Barra Fixa (Pull-up)',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps', 'Core/Abdômen'],
    equipment: 'Sem equipamento',
    difficulty: 3,
    youtubeId: 'eGo4IYmWCQo',
    instructions: [
      'Segure a barra com pegada pronada (palmas para frente), maior que a largura dos ombros.',
      'Inicie o movimento retraindo as escápulas.',
      'Puxe o corpo até o queixo passar da barra.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Fazer meio movimento.', 'Balançar o corpo (kipping).'],
    variations: ['Chin-up (Pegada Supinada)', 'Barra Fixa com Elástico (Assistida)']
  },
  {
    id: 'back-5',
    name: 'Pullover com Haltere',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Peito', 'Tríceps'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'jDxoO4RifM4',
    instructions: [
      'Deite no banco, segurando um haltere com as duas mãos acima do peito.',
      'Mantenha os cotovelos levemente flexionados.',
      'Desça o haltere para trás da cabeça, sentindo alongar as costas.',
      'Puxe de volta para a posição inicial.'
    ],
    commonMistakes: ['Dobrar muito os cotovelos (vira tríceps testa).', 'Tirar o quadril do banco.'],
    variations: ['Pullover na Polia']
  },

  // Ombro
  {
    id: 'shoulder-1',
    name: 'Desenvolvimento com Halteres',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Tríceps'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'qEwKCR5JCog',
    instructions: [
      'Sente-se num banco com apoio para as costas (90 graus).',
      'Erga os halteres até a altura dos ombros.',
      'Empurre os pesos para cima até os braços estenderem quase por completo.',
      'Desça controladamente até a altura das orelhas.'
    ],
    commonMistakes: ['Arquear a lombar.', 'Descer pouco os halteres.'],
    variations: ['Desenvolvimento com Barra', 'Desenvolvimento Máquina']
  },
  {
    id: 'shoulder-2',
    name: 'Elevação Lateral com Halteres',
    muscleGroup: 'Ombro',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: '3VcKaXpzqRo',
    instructions: [
      'Em pé, segure os halteres ao lado do corpo.',
      'Mantenha os cotovelos levemente flexionados.',
      'Eleve os braços lateralmente até a altura dos ombros.',
      'Desça devagar controlando a gravidade.'
    ],
    commonMistakes: ['Usar impulso (balanço).', 'Elevar acima da linha dos ombros.', 'Cotovelos caindo.'],
    variations: ['Elevação Lateral na Polia', 'Elevação Lateral Sentado']
  },
  {
    id: 'shoulder-3',
    name: 'Elevação Frontal com Barra',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Peito'],
    equipment: 'Barra',
    difficulty: 1,
    youtubeId: '-t7fuZ0KhDA',
    instructions: [
      'Segure a barra à frente das coxas.',
      'Sem flexionar os cotovelos, eleve a barra até a altura dos olhos.',
      'Retorne controladamente.'
    ],
    commonMistakes: ['Jogar o corpo para trás.', 'Usar peso excessivo.'],
    variations: ['Elevação Frontal com Halteres', 'Elevação Frontal na Polia']
  },
  {
    id: 'shoulder-4',
    name: 'Crucifixo Invertido na Máquina',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Costas'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: '5yWmZ4L9d1c',
    instructions: [
      'Sente-se virado de frente para o encosto do Peck Deck.',
      'Segure os pegadores e mantenha os braços na altura dos ombros.',
      'Puxe para trás abrindo os braços e apertando as costas/posterior de ombro.',
      'Volte controladamente.'
    ],
    commonMistakes: ['Encolher os ombros.', 'Braços muito esticados ou muito dobrados.'],
    variations: ['Crucifixo Invertido com Halteres', 'Crucifixo Invertido na Polia']
  },

  // Bíceps
  {
    id: 'biceps-1',
    name: 'Rosca Direta com Barra',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Barra',
    difficulty: 1,
    youtubeId: 'kwG2ipFRgfo',
    instructions: [
      'Em pé, segure a barra com pegada supinada na largura dos ombros.',
      'Mantenha os cotovelos colados ao tronco.',
      'Flexione os braços trazendo a barra em direção aos ombros.',
      'Desça até estender quase completamente os braços.'
    ],
    commonMistakes: ['Balançar o corpo.', 'Descolar os cotovelos do tronco para levantar mais peso.'],
    variations: ['Rosca Direta com Barra W', 'Rosca Direta na Polia']
  },
  {
    id: 'biceps-2',
    name: 'Rosca Alternada com Halteres',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: 'sAq_ocpRh_I',
    instructions: [
      'Em pé ou sentado, segure dois halteres.',
      'Flexione um braço girando o pulso (supinação) para cima.',
      'Desça controladamente enquanto sobe o outro braço.'
    ],
    commonMistakes: ['Balanço excessivo.', 'Não girar o pulso (virando rosca martelo).'],
    variations: ['Rosca Simultânea com Halteres']
  },
  {
    id: 'biceps-3',
    name: 'Rosca Martelo',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: 'zC3nLlEvin4',
    instructions: [
      'Segure os halteres com pegada neutra (palmas voltadas para dentro).',
      'Flexione os braços mantendo a pegada neutra.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Balançar o corpo.', 'Usar os ombros para levantar.'],
    variations: ['Rosca Martelo com Corda na Polia']
  },
  {
    id: 'biceps-4',
    name: 'Rosca Scott',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 2,
    youtubeId: 'NM_h9H_K7hQ',
    instructions: [
      'Ajuste o banco para que as axilas descansem no suporte.',
      'Segure a barra (geralmente barra W).',
      'Flexione os braços isolando o movimento.',
      'Desça devagar, evitando hiperestender os braços na parte final.'
    ],
    commonMistakes: ['Esticar totalmente o braço sob carga pesada (risco de lesão).', 'Tirar os cotovelos do apoio.'],
    variations: ['Rosca Scott com Halter Unilateral', 'Rosca Scott na Máquina']
  },

  // Tríceps
  {
    id: 'triceps-1',
    name: 'Tríceps Pulley (Corda)',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 1,
    youtubeId: 'vB5OHsJ3EME',
    instructions: [
      'De frente para a polia alta, segure a corda.',
      'Incline levemente o corpo e trave os cotovelos ao lado do tronco.',
      'Estenda os braços para baixo e abra levemente a corda no final.',
      'Volte controladamente até um ângulo de 90 graus.'
    ],
    commonMistakes: ['Movimentar os cotovelos.', 'Ficar totalmente reto e perto demais do cabo.'],
    variations: ['Tríceps Pulley com Barra Reta']
  },
  {
    id: 'triceps-2',
    name: 'Tríceps Testa com Barra W',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Barra',
    difficulty: 2,
    youtubeId: 'd_KZxk3_kd8',
    instructions: [
      'Deite no banco e segure a barra W acima do peito.',
      'Incline levemente os braços para trás (direção da cabeça).',
      'Flexione apenas os cotovelos, descendo a barra na direção da testa/cabeça.',
      'Estenda os braços.'
    ],
    commonMistakes: ['Cotovelos muito abertos.', 'Mover os ombros (transformando em pullover).'],
    variations: ['Tríceps Testa com Halteres', 'Tríceps Testa na Polia']
  },
  {
    id: 'triceps-3',
    name: 'Tríceps Francês com Halter',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'nRiJVZDpdY0',
    instructions: [
      'Sente-se, segure um halter com as duas mãos acima da cabeça.',
      'Mantenha os cotovelos fechados e apontados para cima.',
      'Desça o peso atrás da cabeça flexionando os cotovelos.',
      'Estenda os braços.'
    ],
    commonMistakes: ['Arquear excessivamente a lombar.', 'Deixar os cotovelos abrirem muito para os lados.'],
    variations: ['Tríceps Francês Unilateral', 'Tríceps Francês na Polia Baixa']
  },
  {
    id: 'triceps-4',
    name: 'Mergulho (Dips)',
    muscleGroup: 'Tríceps',
    secondaryMuscles: ['Peito', 'Ombro'],
    equipment: 'Sem equipamento',
    difficulty: 3,
    youtubeId: '2z8JmcrW-As',
    instructions: [
      'Apoie-se nas barras paralelas.',
      'Mantenha o tronco reto (para focar mais no tríceps do que no peito).',
      'Desça até os cotovelos formarem 90 graus.',
      'Empurre de volta para cima.'
    ],
    commonMistakes: ['Descer demais, forçando o ombro.', 'Balançar o corpo.'],
    variations: ['Mergulho no Banco', 'Mergulho Máquina/Graviton']
  },

  // Pernas (Quadríceps e Gerais)
  {
    id: 'legs-1',
    name: 'Agachamento Livre com Barra',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos', 'Posterior de coxa', 'Core/Abdômen'],
    equipment: 'Barra',
    difficulty: 3,
    youtubeId: 'gcNh17Ckjgg',
    instructions: [
      'Apoie a barra nos trapézios e dê passo atrás.',
      'Pés na largura dos ombros, pontas levemente para fora.',
      'Desça jogando o quadril para trás, mantendo a coluna neutra e peito alto.',
      'Desça pelo menos até as coxas ficarem paralelas ao chão.',
      'Empurre o chão para subir.'
    ],
    commonMistakes: ['Joelhos caindo para dentro (valgo).', 'Arredondar a lombar.', 'Calcanhares saindo do chão.'],
    variations: ['Agachamento Frontal', 'Agachamento com Halteres (Cálice)', 'Agachamento Smith']
  },
  {
    id: 'legs-2',
    name: 'Leg Press 45',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'IZxyjW7OSvc',
    instructions: [
      'Sente na máquina e apoie as costas inteiras no banco.',
      'Pés no meio da plataforma, largura dos ombros.',
      'Destrave a máquina e desça o peso controladamente sem deixar a lombar sair do banco.',
      'Empurre para cima sem estender totalmente (travar) os joelhos no final.'
    ],
    commonMistakes: ['Tirar a lombar do apoio (arredondar).', 'Travar os joelhos com força no topo (perigo).'],
    variations: ['Leg Press Horizontal']
  },
  {
    id: 'legs-3',
    name: 'Cadeira Extensora',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'YyvSfVjQeL0',
    instructions: [
      'Sente-se e alinhe o eixo da máquina com o joelho.',
      'Apoie a almofada acima do tornozelo.',
      'Estenda as pernas contraindo o quadríceps.',
      'Desça controladamente sem despencar os pesos.'
    ],
    commonMistakes: ['Não ajustar a máquina corretamente.', 'Usar impulso (balançar corpo).'],
    variations: ['Cadeira Extensora Unilateral']
  },
  {
    id: 'legs-4',
    name: 'Passada (Lunge) com Halteres',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'D7KaRcUTQeE',
    instructions: [
      'Segure halteres ao lado do corpo.',
      'Dê um passo largo à frente.',
      'Desça o quadril até os dois joelhos formarem 90 graus (joelho de trás quase toca o chão).',
      'Empurre com a perna da frente para voltar à posição inicial ou seguir adiante.'
    ],
    commonMistakes: ['Joelho da frente passando muito a ponta do pé de forma descontrolada.', 'Perder o equilíbrio.'],
    variations: ['Avanço Parado (Split Squat)', 'Passada com Barra', 'Avanço Búlgaro (Pé apoiado atrás)']
  },

  // Posterior e Glúteos
  {
    id: 'hamstrings-1',
    name: 'Stiff com Barra',
    muscleGroup: 'Posterior de coxa',
    secondaryMuscles: ['Glúteos', 'Lombar'],
    equipment: 'Barra',
    difficulty: 3,
    youtubeId: 'CN_7ICAy93M',
    instructions: [
      'Em pé, segure a barra perto do corpo.',
      'Pés na largura do quadril, joelhos levemente destravados.',
      'Jogue o quadril para trás, mantendo a coluna reta, e desça a barra rentes às pernas.',
      'Sinta o posterior alongar e contraia glúteo/posterior para subir.'
    ],
    commonMistakes: ['Arredondar a lombar.', 'Dobrar demais os joelhos (vira levantamento terra).', 'Afastar a barra das pernas.'],
    variations: ['Stiff com Halteres', 'Levantamento Terra Romeno (RDL)']
  },
  {
    id: 'hamstrings-2',
    name: 'Mesa Flexora',
    muscleGroup: 'Posterior de coxa',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'F488k67BTNo',
    instructions: [
      'Deite-se de bruços na máquina.',
      'Alinhe o eixo da máquina aos seus joelhos.',
      'Flexione as pernas trazendo a almofada em direção aos glúteos.',
      'Retorne controladamente.'
    ],
    commonMistakes: ['Elevar o quadril e lombar durante o movimento (compensa com outros músculos).'],
    variations: ['Cadeira Flexora (Sentado)', 'Flexora em Pé Unilateral']
  },
  {
    id: 'glutes-1',
    name: 'Elevação Pélvica (Hip Thrust)',
    muscleGroup: 'Glúteos',
    secondaryMuscles: ['Posterior de coxa'],
    equipment: 'Barra',
    difficulty: 2,
    youtubeId: 'xDoeT9mt6U0',
    instructions: [
      'Apoie a parte superior das costas num banco.',
      'Coloque a barra sobre o quadril (use protetor).',
      'Pés plantados no chão de forma que as canelas fiquem verticais no topo.',
      'Eleve o quadril contraindo os glúteos fortemente no topo.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Hiperextender a lombar no topo (arqueando).', 'Usar peso excessivo e fazer movimento curto.'],
    variations: ['Elevação Pélvica na Máquina', 'Elevação Pélvica com Halter/Anilha']
  },
  {
    id: 'glutes-2',
    name: 'Cadeira Abdutora',
    muscleGroup: 'Glúteos',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'E_Q5G2iJv3o',
    instructions: [
      'Sente na máquina e ajuste os encostos nos joelhos.',
      'Afaste as pernas, vencendo a resistência.',
      'Volte controladamente sem deixar os pesos baterem forte.'
    ],
    commonMistakes: ['Balançar o tronco.'],
    variations: ['Abdução de Quadril na Polia', 'Abdução com Elástico']
  },

  // Panturrilhas
  {
    id: 'calves-1',
    name: 'Elevação de Panturrilha em Pé',
    muscleGroup: 'Panturrilhas',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'YMmgqO8Jo-k',
    instructions: [
      'Apoie os ombros na máquina.',
      'Pés paralelos com as pontas no degrau, calcanhares livres.',
      'Desça os calcanhares para sentir alongar.',
      'Eleve os calcanhares o máximo que puder, contraindo as panturrilhas.'
    ],
    commonMistakes: ['Fazer rápido e quicar (usando tendão, não músculo).', 'Dobrar os joelhos.'],
    variations: ['Panturrilha no Leg Press', 'Panturrilha no Degrau (Corpo livre)']
  },
  {
    id: 'calves-2',
    name: 'Elevação de Panturrilha Sentado',
    muscleGroup: 'Panturrilhas',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'JbyjNymZOt0',
    instructions: [
      'Sente na máquina e apoie o estofado sobre os joelhos/coxas.',
      'Destrave a alavanca.',
      'Desça o calcanhar e, em seguida, eleve-o o mais alto possível.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Movimento incompleto.', 'Uso excessivo de peso com pouca amplitude.'],
    variations: ['Panturrilha Sentado com Halteres nos joelhos']
  },

  // Core / Abdômen
  {
    id: 'core-1',
    name: 'Abdominal Crunch Tradicional',
    muscleGroup: 'Core/Abdômen',
    secondaryMuscles: [],
    equipment: 'Sem equipamento',
    difficulty: 1,
    youtubeId: 'Xyd_fa5zoEU',
    instructions: [
      'Deite de barriga para cima, joelhos dobrados e pés no chão.',
      'Mãos atrás da cabeça (sem puxar o pescoço).',
      'Contraia o abdômen e tire os ombros do chão.',
      'Volte devagar.'
    ],
    commonMistakes: ['Puxar o pescoço com as mãos.', 'Levantar muito até sentar (foca mais nos flexores de quadril).'],
    variations: ['Crunch na Polia', 'Crunch na Máquina']
  },
  {
    id: 'core-2',
    name: 'Prancha Isométrica',
    muscleGroup: 'Core/Abdômen',
    secondaryMuscles: ['Ombro', 'Lombar'],
    equipment: 'Sem equipamento',
    difficulty: 1,
    youtubeId: 'pSHjTRCQxIw',
    instructions: [
      'Apoie os antebraços e as pontas dos pés no chão.',
      'Mantenha o corpo reto, como uma prancha.',
      'Contraia glúteos e abdômen.',
      'Segure a posição pelo tempo estipulado.'
    ],
    commonMistakes: ['Levantar muito o quadril.', 'Deixar o quadril cair e forçar a lombar.', 'Não respirar.'],
    variations: ['Prancha Lateral', 'Prancha com Braços Estendidos']
  },
  {
    id: 'core-3',
    name: 'Elevação de Pernas em Suspensão',
    muscleGroup: 'Core/Abdômen',
    secondaryMuscles: [],
    equipment: 'Barra',
    difficulty: 3,
    youtubeId: 'l41Kpeqg_k4',
    instructions: [
      'Pendure-se em uma barra fixa.',
      'Mantenha o core contraído para evitar balanço.',
      'Eleve as pernas retas ou os joelhos dobrados até 90 graus (ou mais alto).',
      'Desça controladamente.'
    ],
    commonMistakes: ['Balançar excessivamente usando impulso.', 'Não enrolar a pélvis (usando apenas flexores de quadril).'],
    variations: ['Elevação de Pernas Deitado no Chão', 'Elevação de Pernas no Apoio (Cadeira Romana)']
  },
  
  // Mais exercícios - Peito
  {
    id: 'chest-6',
    name: 'Supino Declinado com Barra',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Tríceps', 'Ombro'],
    equipment: 'Barra',
    difficulty: 2,
    youtubeId: 'LfyQBUKR8SE',
    instructions: [
      'Deite no banco declinado e fixe os pés nos apoios.',
      'Pegue a barra com as mãos um pouco mais largas que os ombros.',
      'Desça a barra controladamente até tocar a parte inferior do peito.',
      'Empurre a barra de volta à posição inicial.'
    ],
    commonMistakes: ['Bater a barra no peito.', 'Não fixar bem os pés e escorregar.'],
    variations: ['Supino Declinado com Halteres']
  },
  {
    id: 'chest-7',
    name: 'Crucifixo com Halteres',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Ombro'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'eozdVDA78K0',
    instructions: [
      'Deite num banco reto, segurando dois halteres acima do peito.',
      'Mantenha os cotovelos levemente flexionados (ângulo fixo).',
      'Abra os braços descendo os halteres lateralmente num movimento de abraço.',
      'Retorne contraindo o peitoral.'
    ],
    commonMistakes: ['Dobrar muito os cotovelos (virando um supino).', 'Descer demais e forçar os ombros.'],
    variations: ['Crucifixo Inclinado com Halteres', 'Crucifixo na Máquina']
  },

  // Mais exercícios - Costas
  {
    id: 'back-6',
    name: 'Levantamento Terra (Deadlift)',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Glúteos', 'Posterior de coxa', 'Lombar', 'Core/Abdômen'],
    equipment: 'Barra',
    difficulty: 3,
    youtubeId: 'op9kVnSso6Q',
    instructions: [
      'Pés na largura dos ombros, barra sobre o meio dos pés.',
      'Agache dobrando os joelhos e segure a barra (mãos por fora das pernas).',
      'Coluna reta, peito estufado, levante o peso estendendo quadril e joelhos ao mesmo tempo.',
      'Finalize de pé com glúteos contraídos. Desça controladamente.'
    ],
    commonMistakes: ['Arredondar a lombar.', 'Puxar com as costas antes de empurrar o chão com as pernas.'],
    variations: ['Levantamento Terra Sumô']
  },
  {
    id: 'back-7',
    name: 'Remada Unilateral com Halter (Serrote)',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: 'pYcpY20QaE8',
    instructions: [
      'Apoie o joelho e a mão do mesmo lado num banco.',
      'Com a outra mão, segure o halter.',
      'Puxe o halter em direção ao quadril, mantendo o cotovelo rente ao corpo.',
      'Desça o peso alongando a dorsal.'
    ],
    commonMistakes: ['Puxar para o peito em vez do quadril.', 'Girar demais o tronco.'],
    variations: ['Remada Unilateral na Máquina']
  },

  // Mais exercícios - Ombro
  {
    id: 'shoulder-5',
    name: 'Encolhimento de Ombros',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Costas'],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: 'cJRVVxmytaM',
    instructions: [
      'Em pé, segure um halter em cada mão ao lado do corpo.',
      'Eleve os ombros em direção às orelhas o máximo que conseguir.',
      'Segure um segundo no topo.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Girar os ombros em círculos.', 'Usar os braços para puxar o peso.'],
    variations: ['Encolhimento com Barra', 'Encolhimento no Smith']
  },
  {
    id: 'shoulder-6',
    name: 'Face Pull (Puxada no Rosto)',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Costas'],
    equipment: 'Cabo',
    difficulty: 1,
    youtubeId: 'rep-qVOkqgk',
    instructions: [
      'Prenda uma corda na polia alta.',
      'Puxe a corda em direção ao rosto, separando as mãos.',
      'Cotovelos devem ficar altos, apontando para trás e para fora.',
      'Retorne controladamente.'
    ],
    commonMistakes: ['Cotovelos caídos.', 'Fazer o movimento muito rápido e perder a contração.'],
    variations: ['Face Pull com Elástico']
  },

  // Mais exercícios - Bíceps
  {
    id: 'biceps-5',
    name: 'Rosca Concentrada',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: '0AUGkcgAoG4',
    instructions: [
      'Sente num banco com as pernas afastadas.',
      'Apoie a parte de trás do braço (perto da axila) na parte interna da coxa.',
      'Com o braço totalmente estendido, flexione o cotovelo e suba o peso.',
      'Desça controladamente.'
    ],
    commonMistakes: ['Ajudar balançando o corpo.', 'Apoiar o cotovelo em vez do tríceps.'],
    variations: ['Rosca Concentrada na Polia']
  },

  // Mais exercícios - Tríceps
  {
    id: 'triceps-5',
    name: 'Tríceps Coice (Kickback)',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'ZO81bExngMI',
    instructions: [
      'Apoie uma mão e um joelho num banco, ou incline o tronco para frente.',
      'Eleve o cotovelo até alinhar com o tronco (90 graus).',
      'Estenda o braço completamente para trás.',
      'Retorne devagar sem mover o cotovelo de lugar.'
    ],
    commonMistakes: ['Deixar o cotovelo cair.', 'Balançar o peso no impulso.'],
    variations: ['Tríceps Coice na Polia']
  },

  // Mais exercícios - Pernas
  {
    id: 'legs-5',
    name: 'Agachamento Búlgaro',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Haltere',
    difficulty: 3,
    youtubeId: '2C-uNgKwPLE',
    instructions: [
      'Em pé de costas para um banco, apoie o peito de um dos pés nele.',
      'Dê um passo à frente com o outro pé.',
      'Agache até a coxa da perna da frente ficar paralela ao chão.',
      'Empurre o chão para subir.'
    ],
    commonMistakes: ['Ficar muito perto ou muito longe do banco.', 'Perder o equilíbrio (olhe para um ponto fixo).'],
    variations: ['Agachamento Búlgaro com Barra', 'Agachamento Búlgaro no Smith']
  },
  {
    id: 'legs-6',
    name: 'Agachamento Sumô',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos', 'Posterior de coxa'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: '9ZuAM5VG4y4',
    instructions: [
      'Afaste os pés além da largura dos ombros, pontas apontando para fora.',
      'Segure um halter (ou kettlebell) com as duas mãos à frente do corpo.',
      'Agache mantendo o tronco reto, joelhos seguindo a linha dos pés.',
      'Volte empurrando com os calcanhares.'
    ],
    commonMistakes: ['Joelhos caindo para dentro.', 'Dobrar o tronco excessivamente para frente.'],
    variations: ['Levantamento Terra Sumô com Barra']
  },

  // Mais exercícios - Core
  {
    id: 'core-4',
    name: 'Russian Twist (Giro Russo)',
    muscleGroup: 'Core/Abdômen',
    secondaryMuscles: [],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'wkD8rjkodUI',
    instructions: [
      'Sente no chão e incline levemente o tronco para trás (ângulo de 45 graus).',
      'Tire os pés do chão ou deixe os calcanhares apoiados.',
      'Gire o tronco levando o peso de um lado para o outro do quadril.',
      'Mantenha o core firme.'
    ],
    commonMistakes: ['Mover apenas os braços e não o tronco.', 'Curvar demais as costas.'],
    variations: ['Giro Russo sem Peso', 'Giro Russo na Bola Suíça']
  },
  
  // Novos 20 Exercícios (Cabos, Máquinas, Kettlebells)
  {
    id: 'chest-8',
    name: 'Crossover na Polia Média',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Ombro'],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: 'taI4XduLpTk',
    instructions: [
      'Posicione as polias na altura do peito.',
      'Dê um passo à frente com uma perna para estabilizar.',
      'Traga as mãos juntas à frente do peito, mantendo cotovelos levemente flexionados.',
      'Controle o retorno até sentir um leve alongamento no peitoral.'
    ],
    commonMistakes: ['Dobrar muito os cotovelos', 'Usar muito peso e perder a postura'],
    variations: ['Crossover Polia Alta', 'Crossover Polia Baixa']
  },
  {
    id: 'chest-9',
    name: 'Peck Deck (Voador)',
    muscleGroup: 'Peito',
    secondaryMuscles: ['Ombro'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'Z5ZAJGQ9EHQ',
    instructions: [
      'Ajuste o assento para que os puxadores fiquem na altura do peito.',
      'Sente-se com as costas apoiadas.',
      'Junte os braços à frente do corpo apertando o peitoral.',
      'Retorne lentamente até o braço ficar paralelo ao tronco.'
    ],
    commonMistakes: ['Afastar as costas do encosto', 'Relaxar o braço na volta'],
    variations: ['Crucifixo Máquina']
  },
  {
    id: 'back-8',
    name: 'Pulldown com Braços Estendidos',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Tríceps'],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: 'GjH-T9lq0E4',
    instructions: [
      'Use uma barra reta ou corda na polia alta.',
      'Incline o tronco levemente para a frente com os braços esticados.',
      'Puxe a barra até a coxa mantendo os braços quase retos.',
      'Controle o retorno até a altura do rosto.'
    ],
    commonMistakes: ['Dobrar muito os cotovelos', 'Mover o tronco durante a puxada'],
    variations: ['Pulldown com Corda']
  },
  {
    id: 'back-9',
    name: 'Remada Sentada com Triângulo',
    muscleGroup: 'Costas',
    secondaryMuscles: ['Bíceps', 'Ombro'],
    equipment: 'Cabo',
    difficulty: 1,
    youtubeId: 'GZbfZ033f74',
    instructions: [
      'Sente-se no aparelho com os pés apoiados.',
      'Mantenha as costas retas e puxe o triângulo até o abdômen.',
      'Esprema as escápulas juntas no final do movimento.',
      'Retorne esticando os braços sem curvar a coluna.'
    ],
    commonMistakes: ['Jogar o tronco para trás', 'Encolher os ombros'],
    variations: ['Remada Sentada Barra Reta']
  },
  {
    id: 'shoulder-7',
    name: 'Elevação Lateral na Polia',
    muscleGroup: 'Ombro',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: 'lQqB4iMmd04',
    instructions: [
      'Posicione a polia no nível mais baixo.',
      'Segure o puxador com a mão mais distante da máquina (cruzando a frente do corpo).',
      'Eleve o braço lateralmente até a altura do ombro.',
      'Desça o peso controladamente.'
    ],
    commonMistakes: ['Usar impulso do corpo', 'Elevar acima da altura do ombro'],
    variations: ['Elevação Lateral com Haltere']
  },
  {
    id: 'shoulder-8',
    name: 'Desenvolvimento Máquina',
    muscleGroup: 'Ombro',
    secondaryMuscles: ['Tríceps'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'WvLMauqrnK8',
    instructions: [
      'Ajuste o assento para que as pegadas fiquem alinhadas com os ombros.',
      'Empurre o peso para cima até quase esticar os braços.',
      'Desça lentamente até as mãos chegarem na linha do queixo.',
      'Mantenha o abdômen contraído e as costas no apoio.'
    ],
    commonMistakes: ['Curvar a lombar excessivamente', 'Travar os cotovelos no topo'],
    variations: ['Desenvolvimento com Halteres']
  },
  {
    id: 'biceps-6',
    name: 'Rosca Scott Máquina',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'C4hF8N1Uj4U',
    instructions: [
      'Ajuste a altura do assento para que as axilas repousem confortavelmente no apoio.',
      'Segure os pegadores com as palmas para cima.',
      'Flexione os braços em direção aos ombros.',
      'Estique os braços lentamente, parando um pouco antes da extensão total.'
    ],
    commonMistakes: ['Levantar o tronco do banco', 'Deixar o peso despencar na descida'],
    variations: ['Rosca Scott com Barra EZ']
  },
  {
    id: 'biceps-7',
    name: 'Rosca Martelo na Polia com Corda',
    muscleGroup: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 1,
    youtubeId: 'vjwGzBiv9mI',
    instructions: [
      'Conecte uma corda na polia baixa.',
      'Segure as extremidades da corda com as palmas voltadas uma para a outra.',
      'Puxe a corda para cima mantendo os cotovelos ao lado do corpo.',
      'Desça de maneira controlada.'
    ],
    commonMistakes: ['Mover os cotovelos para frente e para trás', 'Usar balanço do corpo'],
    variations: ['Rosca Martelo Haltere']
  },
  {
    id: 'triceps-6',
    name: 'Tríceps Testa na Polia Alta',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: 'nRiJVZDpdY0',
    instructions: [
      'Fique de costas para a polia alta, segurando a corda acima da cabeça.',
      'Incline o tronco para frente.',
      'Estique os braços à frente sem mover os cotovelos.',
      'Retorne lentamente até as mãos passarem pela cabeça.'
    ],
    commonMistakes: ['Cotovelos abrindo para os lados', 'Movimentar os ombros'],
    variations: ['Tríceps Testa Barra']
  },
  {
    id: 'triceps-7',
    name: 'Tríceps Unilateral Inverso na Polia',
    muscleGroup: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: '1eOOF3g3H3E',
    instructions: [
      'Fique de frente para a polia alta e segure um puxador simples com pegada supinada (palma para cima).',
      'Mantenha o cotovelo fixo na lateral do corpo.',
      'Puxe o cabo para baixo até estender o braço.',
      'Controle o retorno até formar 90 graus.'
    ],
    commonMistakes: ['Usar peso demais', 'Descolar o cotovelo do tronco'],
    variations: ['Tríceps Unilateral Pronado']
  },
  {
    id: 'legs-7',
    name: 'Leg Press 45',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos', 'Panturrilhas'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'IZxyjW7OSvc',
    instructions: [
      'Sente-se no Leg Press e posicione os pés na plataforma na largura dos ombros.',
      'Destrave a máquina e desça a plataforma até os joelhos formarem 90 graus.',
      'Empurre a plataforma de volta usando o calcanhar e meio do pé.',
      'Não estique os joelhos completamente no topo (não "trave" a articulação).'
    ],
    commonMistakes: ['Tirar a lombar do apoio na descida', 'Pés muito baixos forçando o joelho'],
    variations: ['Leg Press Horizontal']
  },
  {
    id: 'legs-8',
    name: 'Cadeira Extensora',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'YyvSfVjQeL0',
    instructions: [
      'Ajuste a máquina para que o joelho fique alinhado com o eixo de rotação.',
      'Apoie o rolo acima do tornozelo.',
      'Estenda os joelhos subindo o peso até a contração máxima das coxas.',
      'Desça de forma controlada.'
    ],
    commonMistakes: ['Balançar o corpo', 'Tirar o quadril do banco'],
    variations: ['Extensora Unilateral']
  },
  {
    id: 'legs-9',
    name: 'Cadeira Flexora',
    muscleGroup: 'Posterior de coxa',
    secondaryMuscles: ['Panturrilhas'],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'F488k67BTNo',
    instructions: [
      'Sente-se com o rolo de apoio posicionado atrás dos tornozelos.',
      'Abaixe a trava superior sobre as coxas.',
      'Puxe os calcanhares para trás e para baixo até embaixo do assento.',
      'Retorne resistindo ao peso.'
    ],
    commonMistakes: ['Deixar o peso bater na volta', 'Apoio no lugar errado'],
    variations: ['Mesa Flexora (Deitado)']
  },
  {
    id: 'legs-10',
    name: 'Cadeira Abdutora',
    muscleGroup: 'Glúteos',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'f0-qOio5D7Q',
    instructions: [
      'Sente-se na máquina com os joelhos entre os apoios laterais.',
      'Empurre as pernas para fora contra a resistência.',
      'Faça uma pausa rápida na abertura máxima.',
      'Volte controlando o peso.'
    ],
    commonMistakes: ['Movimento muito rápido', 'Tirar as costas do banco'],
    variations: ['Abdução com Elástico']
  },
  {
    id: 'legs-11',
    name: 'Cadeira Adutora',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'N9m70KizBXY',
    instructions: [
      'Sente-se na máquina com as pernas por fora dos apoios.',
      'Feche as pernas espremendo as coxas (adutores).',
      'Pausa no momento de maior contração.',
      'Volte abrindo lentamente.'
    ],
    commonMistakes: ['Jogar muito peso e perder amplitude', 'Fazer o movimento embalado'],
    variations: ['Adução na Polia']
  },
  {
    id: 'legs-12',
    name: 'Levantamento Terra com Kettlebell',
    muscleGroup: 'Posterior de coxa',
    secondaryMuscles: ['Glúteos', 'Lombar'],
    equipment: 'Haltere',
    difficulty: 2,
    youtubeId: 'pQhIe8sS0l8',
    instructions: [
      'Posicione o kettlebell entre os pés.',
      'Flexione os joelhos e o quadril, mantendo a coluna neutra e segure a alça.',
      'Empurre o chão com os pés e contraia glúteos para ficar em pé.',
      'Retorne o kettlebell ao chão refazendo o movimento.'
    ],
    commonMistakes: ['Costas arredondadas', 'Fazer um agachamento em vez de usar o quadril'],
    variations: ['Levantamento Terra com Barra']
  },
  {
    id: 'legs-13',
    name: 'Goblet Squat (Agachamento Cálice)',
    muscleGroup: 'Pernas (quadríceps)',
    secondaryMuscles: ['Glúteos', 'Core/Abdômen'],
    equipment: 'Haltere',
    difficulty: 1,
    youtubeId: 'MeIiIdhgPwg',
    instructions: [
      'Segure um halter ou kettlebell verticalmente junto ao peito.',
      'Mantenha os cotovelos apontados para baixo.',
      'Agache até que os cotovelos passem pela linha dos joelhos.',
      'Suba empurrando pelo calcanhar.'
    ],
    commonMistakes: ['Deixar o peso afastar do corpo', 'Joelhos indo para dentro'],
    variations: ['Agachamento Livre']
  },
  {
    id: 'calves-3',
    name: 'Panturrilha no Leg Press',
    muscleGroup: 'Panturrilhas',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'dG_I2o72gB8',
    instructions: [
      'No Leg Press, apoie apenas a ponta dos pés na parte inferior da plataforma.',
      'Mantenha os joelhos quase totalmente retos (mas não travados).',
      'Empurre a plataforma apontando os dedos do pé (flexão plantar).',
      'Desça o máximo que conseguir sentindo alongar a panturrilha.'
    ],
    commonMistakes: ['Dobrar os joelhos', 'Fazer movimento muito curto'],
    variations: ['Panturrilha em Pé Máquina']
  },
  {
    id: 'calves-4',
    name: 'Panturrilha Sentado Máquina',
    muscleGroup: 'Panturrilhas',
    secondaryMuscles: [],
    equipment: 'Máquina',
    difficulty: 1,
    youtubeId: 'JbyjNymZOt0',
    instructions: [
      'Sente-se na máquina e ajuste as almofadas sobre os joelhos.',
      'Coloque a ponta dos pés na plataforma.',
      'Levante os calcanhares o mais alto possível.',
      'Desça lentamente, alongando bem no final do movimento.'
    ],
    commonMistakes: ['Pausar muito embaixo perdendo tensão', 'Usar peso demais e fazer o movimento curto'],
    variations: ['Panturrilha com Halteres Sentado']
  },
  {
    id: 'core-5',
    name: 'Crunch na Polia (Abdominal Cabo)',
    muscleGroup: 'Core/Abdômen',
    secondaryMuscles: [],
    equipment: 'Cabo',
    difficulty: 2,
    youtubeId: '2EP1AQIEJ5A',
    instructions: [
      'Ajoelhe-se de frente ou de costas para a polia alta usando a corda.',
      'Segure a corda atrás da nuca ou testa.',
      'Flexione o tronco para baixo, contraindo o abdômen em direção ao joelho.',
      'Volte controlando sem esticar demais a coluna.'
    ],
    commonMistakes: ['Usar os braços para puxar', 'Mexer o quadril e não a coluna'],
    variations: ['Crunch no Chão', 'Abdominal Máquina']
  }
];
