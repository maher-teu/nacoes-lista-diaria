// Endereço do Supabase e chave pública (feita para ficar no navegador; a segurança
// está nas funções do banco, que exigem login). Sem estes dados o app abre em modo demonstração.
window.APP_CONFIG = {
  supabaseUrl: 'https://hntmjppwecolqjzgfgpy.supabase.co',
  supabaseKey: 'sb_publishable_mm6VehPFEsScqRtAu-sdkA_PDME-D9Z',
  users: {
    loja: 'loja@nacoes-lista.app',
    dona: 'dona@nacoes-lista.app',
  },
};
