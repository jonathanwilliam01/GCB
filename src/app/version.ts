export const VERSION = 'V1.26.10.09';

export const PATCH_NOTES: { version: string; date: string; items: string[] }[] = [
  {
    version: 'V1.26.10.09',
    date: '2026-10-28',
    items: [
      'Soneca complementar: registra o cochilo extra logo após uma soneca (botão "+ Complementar" ou tocando no número da soneca), e a próxima janela passa a contar do fim dele',
    ],
  },
  {
    version: 'V1.26.10.08',
    date: '2026-10-28',
    items: [
      'Seu nome para quem acompanha (ex.: Mamãe), mostrado nos registros que você fizer',
      'Mostra quem registrou o acordar, cada soneca, o sono noturno, os alimentos e as medidas',
      'Aviso na hora quando outra pessoa registra algo do dia (ex.: "Papai: 😴 dormiu 14h20")',
      'Card próprio para excluir o bebê (dono) ou deixar de acompanhar, no fim da tela do bebê',
    ],
  },
  {
    version: 'V1.26.10.07',
    date: '2026-10-26',
    items: [
      'Login com e-mail e senha; dados salvos na conta em vez do navegador',
      'Compartilhar o bebê com outras pessoas por código, com atualização em tempo real',
      'Dados que estavam só no aparelho podem ser levados para a conta no primeiro acesso',
      'Funciona sem internet: alterações ficam no aparelho e são enviadas ao reconectar',
      'Vários bebês na mesma conta, com troca pelo menu',
      'Dono do bebê: gera novo código, remove quem acompanha e exclui o bebê',
      'Esqueci minha senha por e-mail',
    ],
  },
  {
    version: 'V1.26.10.06',
    date: '2026-10-26',
    items: [
      'Novos lembretes: janela passou do horário (ainda acordado), soneca longa e lembrete de registrar o acordar',
      'Cada lembrete pode ser ligado/desligado e ter o tempo ajustado',
      'Aviso fica fixo no topo do app até fechar, com botão para registrar na hora (Dormiu/Acordou)',
      'Avisos perdidos com o app em segundo plano aparecem ao voltar, sem repetir os já mostrados',
    ],
  },
  {
    version: 'V1.26.10.05',
    date: '2026-10-26',
    items: [
      'Foto do bebê: ajustar enquadramento (arrastar e zoom) ao escolher ou depois, e tocar para ver em tela cheia',
      'Nome do app personalizado: aparece no cabeçalho, menu, título e no app instalado',
    ],
  },
  {
    version: 'V1.26.10.04',
    date: '2026-10-25',
    items: ['Nova logo do GCB (bebê dormindo na lua) no ícone do app, favicon, tela de abertura, cabeçalho e menu'],
  },
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
