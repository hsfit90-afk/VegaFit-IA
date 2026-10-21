import { describe, it, expect } from 'vitest';
import { traduzirErro, MENSAGEM_GENERICA } from '@/utils/mensagensDeErro';

describe('traduzirErro — o caso que deu origem ao módulo', () => {
  it('traduz "Invalid login credentials" e diz o que fazer', () => {
    // 20/10/2026: uma aluna leu exatamente este texto, em ingles, e nao tinha como saber se
    // era a senha, a conta ou o app quebrado.
    const r = traduzirErro({ message: 'Invalid login credentials' });
    expect(r).toContain('E-mail ou senha incorretos');
    expect(r).toContain('Esqueceu sua senha?');
    expect(r).not.toContain('Invalid');
  });

  it('o codigo vale tanto quanto o texto', () => {
    // O Supabase pode reescrever a frase em ingles; o codigo nao muda.
    expect(traduzirErro({ code: 'invalid_credentials', message: 'qualquer coisa nova' }))
      .toContain('E-mail ou senha incorretos');
  });

  it('o codigo tem precedencia sobre o texto', () => {
    const r = traduzirErro({ code: 'weak_password', message: 'Invalid login credentials' });
    expect(r).toContain('pelo menos 6 caracteres');
  });
});

describe('traduzirErro — erros de autenticacao', () => {
  const casos: [string, string][] = [
    ['Email not confirmed', 'não foi confirmado'],
    ['User already registered', 'Já existe uma conta'],
    ['Password should be at least 6 characters.', 'pelo menos 6 caracteres'],
    ['New password should be different from the old password.', 'diferente da anterior'],
    ['Unable to validate email address: invalid format', 'não parece válido'],
    ['Email rate limit exceeded', 'Espere alguns minutos'],
    ['Email link is invalid or has expired', 'expirou ou já foi usado'],
    ['Token has expired or is invalid', 'expirou ou já foi usado'],
    ['Auth session missing!', 'sessão expirou'],
    ['Signups not allowed for this instance', 'cadastro está fechado'],
    ['User not found', 'Não encontrei nenhuma conta'],
  ];

  for (const [entrada, esperado] of casos) {
    it(`traduz "${entrada.slice(0, 40)}"`, () => {
      expect(traduzirErro({ message: entrada })).toContain(esperado);
    });
  }

  it('casa o limite de tentativas mesmo com o numero variavel', () => {
    // A frase termina com um numero que muda a cada tentativa. Exigir igualdade exata faria a
    // traducao falhar justamente no caso mais comum.
    const a = traduzirErro({ message: 'For security purposes, you can only request this after 47 seconds.' });
    const b = traduzirErro({ message: 'For security purposes, you can only request this after 9 seconds.' });
    expect(a).toContain('muitas tentativas seguidas');
    expect(a).toBe(b);
  });

  it('nao depende de caixa nem de espaco em volta', () => {
    expect(traduzirErro({ message: '  INVALID LOGIN CREDENTIALS  ' })).toContain('E-mail ou senha incorretos');
  });
});

describe('traduzirErro — falha de rede', () => {
  it('cobre os tres navegadores, que escrevem diferente', () => {
    const chrome = traduzirErro(new Error('Failed to fetch'));
    const firefox = traduzirErro(new Error('NetworkError when attempting to fetch resource.'));
    const safari = traduzirErro(new Error('Load failed'));
    expect(chrome).toContain('Sem conexão');
    expect(firefox).toBe(chrome);
    expect(safari).toBe(chrome);
  });

  it('rede vence o padrao de quem chamou', () => {
    // O ponto do modulo nas telas que falam com a nossa API: a mensagem da rota so vale quando
    // a rota respondeu. Se o celular perdeu o sinal, quem manda e o erro de rede.
    expect(traduzirErro(new Error('Failed to fetch'), 'Não consegui salvar o treino.'))
      .toContain('Sem conexão');
  });

  it('traduz requisicao abortada por tempo', () => {
    expect(traduzirErro({ message: 'The operation was aborted.' })).toContain('demorou demais');
  });
});

describe('traduzirErro — o que ele NAO faz', () => {
  it('devolve o padrao quando nao conhece o erro', () => {
    // As telas que falam com a nossa API ja recebem portugues bom. Trocar por generico seria
    // perder informacao.
    expect(traduzirErro({ message: 'erro_interno_xyz' }, 'Não consegui salvar o treino.'))
      .toBe('Não consegui salvar o treino.');
  });

  it('preserva a mensagem em portugues da nossa propria rota', () => {
    const daRota = 'Você já tem uma assinatura ativa.';
    expect(traduzirErro(new Error(daRota), daRota)).toBe(daRota);
  });

  it('cai no generico so quando nao ha padrao', () => {
    expect(traduzirErro({ message: 'kaboom' })).toBe(MENSAGEM_GENERICA);
    expect(traduzirErro({ message: 'kaboom' }, '   ')).toBe(MENSAGEM_GENERICA);
  });

  it('o generico nao culpa o usuario nem expoe detalhe tecnico', () => {
    expect(MENSAGEM_GENERICA).not.toMatch(/erro \d|stack|undefined|null|500/i);
    expect(MENSAGEM_GENERICA).toContain('Tente de novo');
  });
});

describe('traduzirErro — formatos de entrada que de fato chegam', () => {
  it('aguenta Error, objeto solto, string, null e undefined', () => {
    expect(traduzirErro(new Error('Invalid login credentials'))).toContain('E-mail ou senha');
    expect(traduzirErro({ message: 'Invalid login credentials' })).toContain('E-mail ou senha');
    expect(traduzirErro('Invalid login credentials')).toContain('E-mail ou senha');
    expect(traduzirErro(null)).toBe(MENSAGEM_GENERICA);
    expect(traduzirErro(undefined)).toBe(MENSAGEM_GENERICA);
    expect(traduzirErro(42)).toBe(MENSAGEM_GENERICA);
    expect(traduzirErro({})).toBe(MENSAGEM_GENERICA);
  });

  it('erro sem mensagem usa o padrao de quem chamou', () => {
    expect(traduzirErro({}, 'Não consegui carregar.')).toBe('Não consegui carregar.');
  });

  it('le error_code, que alguns erros trazem no lugar de code', () => {
    expect(traduzirErro({ error_code: 'otp_expired', message: '' })).toContain('expirou');
  });

  it('campo de tipo errado nao quebra', () => {
    expect(traduzirErro({ code: 123, message: ['nao', 'e', 'string'] })).toBe(MENSAGEM_GENERICA);
  });
});

describe('traduzirErro — pagamento', () => {
  it('explica gateway sem configuracao', () => {
    expect(traduzirErro(new Error('MERCADOPAGO_ACCESS_TOKEN nao configurado')))
      .toContain('ainda não está configurado');
  });

  it('traduz a falha de abrir o pagamento', () => {
    expect(traduzirErro(new Error('Nao foi possivel abrir o pagamento')))
      .toContain('tela de pagamento');
  });
});

describe('traduzirErro — toda mensagem e util', () => {
  it('nenhuma tradução sai em ingles ou com nome de variavel', () => {
    const amostras = [
      'Invalid login credentials', 'Email not confirmed', 'User already registered',
      'Password should be at least 6 characters.', 'Auth session missing!',
      'Failed to fetch', 'Email link is invalid or has expired',
    ];
    for (const a of amostras) {
      const r = traduzirErro({ message: a });
      expect(r).not.toMatch(/[A-Z_]{4,}/);          // nome de variavel/constante
      expect(r).not.toMatch(/\b(error|invalid|failed|token)\b/i);
      expect(r.length).toBeGreaterThan(20);          // frase, nao rotulo
    }
  });
});
