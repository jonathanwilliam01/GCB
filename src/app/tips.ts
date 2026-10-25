// Referências gerais (SBP, Ministério da Saúde, AASM, CDC). Não substituem o pediatra.

export interface SleepTip {
  to: number;
  label: string;
  window: string;
  naps: string;
  total: string;
  windows: number[];
}

export const SLEEP: SleepTip[] = [
  { to: 1, label: '0 a 1 mês', window: '35 min a 1h', naps: '4 a 6 ou mais', total: '14 a 17h', windows: [45, 45, 45, 45, 45, 60] },
  { to: 2, label: '1 a 2 meses', window: '1h a 1h30', naps: '4 a 5', total: '14 a 17h', windows: [60, 75, 75, 75, 90] },
  { to: 3, label: '2 a 3 meses', window: '1h15 a 1h45', naps: '4 a 5', total: '14 a 17h', windows: [75, 90, 90, 90, 105] },
  { to: 4, label: '3 a 4 meses', window: '1h30 a 2h', naps: '4', total: '12 a 16h', windows: [90, 105, 105, 120] },
  { to: 5, label: '4 a 5 meses', window: '1h45 a 2h15', naps: '3 a 4', total: '12 a 16h', windows: [105, 120, 120, 135] },
  { to: 6, label: '5 a 6 meses', window: '2h a 2h30', naps: '3', total: '12 a 16h', windows: [120, 135, 150, 150] },
  { to: 8, label: '6 a 8 meses', window: '2h15 a 3h', naps: '3 (indo para 2)', total: '12 a 16h', windows: [135, 150, 150, 180] },
  { to: 10, label: '8 a 10 meses', window: '2h30 a 3h30', naps: '2', total: '12 a 16h', windows: [150, 180, 210] },
  { to: 12, label: '10 a 12 meses', window: '3h a 4h', naps: '2', total: '12 a 16h', windows: [180, 210, 240] },
  { to: 15, label: '12 a 15 meses', window: '3h30 a 4h30', naps: '2 (indo para 1)', total: '11 a 14h', windows: [210, 240, 270] },
  { to: 18, label: '15 a 18 meses', window: '5h a 6h', naps: '1', total: '11 a 14h', windows: [300, 330] },
  { to: 24, label: '18 a 24 meses', window: '5h a 6h', naps: '1', total: '11 a 14h', windows: [330, 360] },
  { to: Infinity, label: '2 anos ou mais', window: '5h30 a 6h30', naps: '0 a 1', total: '10 a 13h', windows: [360, 360] },
];

export interface FoodPhase {
  to: number;
  title: string;
  tips: string[];
}

export const FOOD: FoodPhase[] = [
  {
    to: 6,
    title: 'Aleitamento exclusivo',
    tips: [
      'Somente leite materno ou fórmula, em livre demanda.',
      'Não oferecer água, chás, sucos ou papinhas antes dos 6 meses.',
    ],
  },
  {
    to: 7,
    title: 'Início da introdução alimentar',
    tips: [
      'Fruta amassada nos lanches e papa salgada no almoço.',
      'Papa: cereal ou tubérculo + feijão + carne ou ovo + legume ou verdura.',
      'Amassar com garfo, sem liquidificar nem peneirar.',
      'Oferecer água nos intervalos.',
      'Um alimento novo por vez, observando por 2 a 3 dias.',
    ],
  },
  {
    to: 9,
    title: 'Segunda refeição salgada',
    tips: [
      'Almoço e jantar com comida amassada ou em pedaços macios.',
      'Aumentar a consistência aos poucos.',
      'Deixar o bebê pegar e explorar a comida com as mãos.',
    ],
  },
  {
    to: 12,
    title: 'Pedaços e comida da família',
    tips: [
      'Alimentos picados ou em pedaços, perto da comida da família.',
      'Estimular comer com as mãos e beber no copo.',
    ],
  },
  {
    to: Infinity,
    title: 'Comida da família',
    tips: [
      'Mesma comida da família, com pouco sal e sem temperos prontos.',
      'Leite de vaca e mel podem entrar a partir de 1 ano.',
      '5 a 6 refeições por dia: café, lanche, almoço, lanche, jantar e ceia.',
    ],
  },
];

export const AVOID = [
  'Açúcar, doces e refrigerante até 2 anos',
  'Ultraprocessados (biscoito recheado, salgadinho, embutidos, temperos prontos)',
  'Mel antes de 1 ano',
  'Leite de vaca como bebida antes de 1 ano',
  'Suco no lugar da fruta',
  'Alimentos duros e redondos inteiros (uva, pipoca, castanhas): risco de engasgo',
];

export const FOODS_TO_TRY: { group: string; items: string[] }[] = [
  { group: 'Frutas', items: ['Banana', 'Maçã', 'Pera', 'Mamão', 'Manga', 'Abacate', 'Melancia', 'Laranja', 'Ameixa', 'Goiaba', 'Morango', 'Kiwi'] },
  { group: 'Legumes e verduras', items: ['Abóbora', 'Cenoura', 'Abobrinha', 'Chuchu', 'Brócolis', 'Beterraba', 'Couve', 'Espinafre', 'Vagem', 'Tomate'] },
  { group: 'Cereais e tubérculos', items: ['Batata', 'Batata-doce', 'Mandioca', 'Inhame', 'Arroz', 'Macarrão', 'Aveia', 'Milho'] },
  { group: 'Proteínas', items: ['Carne bovina', 'Frango', 'Peixe', 'Ovo', 'Fígado'] },
  { group: 'Leguminosas', items: ['Feijão', 'Lentilha', 'Grão-de-bico', 'Ervilha'] },
];

export const ALLERGENS = ['ovo', 'peixe', 'macarrão', 'trigo', 'amendoim', 'leite', 'soja', 'camarão'];

export const MILESTONES: { at: number; items: string[] }[] = [
  { at: 2, items: ['Sorri quando falam com ele', 'Olha para rostos', 'Levanta a cabeça de bruços'] },
  { at: 4, items: ['Sustenta a cabeça sem apoio', 'Leva as mãos à boca', 'Ri e faz sons'] },
  { at: 6, items: ['Rola de barriga para cima e para baixo', 'Reconhece pessoas conhecidas', 'Balbucia'] },
  { at: 9, items: ['Senta sem apoio', 'Passa objetos de uma mão para outra', 'Reage quando chamam o nome'] },
  { at: 12, items: ['Fica em pé com apoio', 'Dá tchau', 'Fala "mamã" ou "papá" com sentido'] },
  { at: 15, items: ['Dá alguns passos sozinho', 'Aponta para pedir', 'Fala 1 ou 2 palavras além de mamã/papá'] },
  { at: 18, items: ['Anda sozinho', 'Tenta comer de colher', 'Fala 3 ou mais palavras'] },
  { at: 24, items: ['Corre e chuta bola', 'Junta 2 palavras', 'Aponta partes do corpo'] },
];

export const CHECKUPS = [0.25, 1, 2, 4, 6, 9, 12, 18, 24];

export const sleepTip = (m: number) => SLEEP.find((s) => m < s.to)!;
export const foodPhase = (m: number) => FOOD.find((f) => m < f.to)!;
export const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const isAllergen = (food: string) => ALLERGENS.some((a) => norm(food).includes(a));

export const untried = (tried: string[]) => {
  const set = new Set(tried.map(norm));
  const lists = FOODS_TO_TRY.map((g) => g.items.filter((f) => !set.has(norm(f))));
  // intercala os grupos para variar as sugestões
  const out: string[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) lists.forEach((l) => l[i] && out.push(l[i]));
  return out;
};
