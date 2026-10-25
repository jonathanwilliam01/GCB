export const VERSION = 'V1.26.10.03';

export const PATCH_NOTES: { version: string; date: string; items: string[] }[] = [
  {
    version: 'V1.26.10.03',
    date: '2026-10-25',
    items: [
      'Botão rápido (+) em todas as telas: acordou, dormiu, sono noturno e comeu em um toque',
      'Lembretes de hora de dormir (com antecedência configurável) e de refeições',
      'App instalável (PWA): ícone na tela inicial, funciona sem internet e avisa quando há nova versão',
      'Relatório de janelas planejado x real, com sugestão de ajuste em um toque',
      'Exportar sono, alimentação e medidas em planilha (CSV)',
      'Backup automático: cópia diária no aparelho (últimos 7 dias), arquivo salvo sozinho no PC e compartilhar backup pelo celular',
    ],
  },
  {
    version: 'V1.26.10.02',
    date: '2026-10-25',
    items: [
      'Visão geral: status do bebê, resumo do dia, linha do tempo com sonecas e refeições, alimentos de hoje, última medida e avisos',
      'Relatórios de 7, 14 e 30 dias: médias de sono, horas de sono por dia, diário do sono e tabela',
      'Relatório de alimentação: reações, alimentos novos, recusados e reações registradas',
      'Copiar resumo e imprimir/salvar relatório em PDF',
      'Aviso de backup pendente',
    ],
  },
  {
    version: 'V1.26.10.01',
    date: '2026-10-25',
    items: [
      'Controle de sono: hora que acordou, janelas de vigília, sonecas, sono noturno e previsão da próxima soneca',
      'Resumo do dia para copiar e colar',
      'Registro de alimentos com reação, histórico e resumo por alimento',
      'Medidas (peso, altura e cabeça) com gráfico comparativo à mediana OMS',
      'Cadastro do bebê com foto e janelas padrão',
      'Dicas por idade: sono, alimentação, alimentos para experimentar e desenvolvimento',
      'Horários de refeição sugeridos pelas janelas e sonecas do dia, com plano editável',
      'Menu lateral, tema claro/escuro e salvamento automático com aviso',
      'Máscaras nos campos de hora, data, medidas e janelas',
      'Exportar e importar backup em JSON',
    ],
  },
];
