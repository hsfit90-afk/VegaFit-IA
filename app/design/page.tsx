"use client";

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { Dumbbell, Timer, MoreVertical, ImageOff } from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { BarraDeProgresso, AnelDeProgresso } from '@/components/ui/Progresso';
import { Segmentado } from '@/components/ui/Segmentado';
import { LinhaDeLista } from '@/components/ui/LinhaDeLista';
import { FolhaInferior } from '@/components/ui/FolhaInferior';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Vitrine dos componentes, para aprovar no celular antes de aplicar nas telas.
 *
 * TEMPORÁRIA. O profissional apaga quando a reforma terminar.
 *
 * POR QUE O GUARDA É DIFERENTE DO RESTO DO ADMIN
 *
 * As telas de /admin não se protegem no cliente: elas renderizam e os dados não vêm, porque
 * /api/admin/* responde 404 para quem não é master. É proteção de DADO, e funciona porque ali
 * sempre há uma chamada de API.
 *
 * Esta tela não tem API nenhuma — é só apresentação. Então o guarda precisa estar aqui, e
 * `notFound()` é o certo: responde 404, não 403. Confirmar que a rota existe já entrega
 * informação a quem está sondando, que é a regra do projeto para /api/admin.
 *
 * O 404 SÓ DEPOIS DO PERFIL CARREGAR. Enquanto `profile` é null a resposta é "não sei ainda",
 * não "não pode" — chamar notFound() cedo expulsaria o próprio master a cada recarga.
 */
export default function DesignPage() {
  const { profile } = useAppContext();
  const [tema, setTema] = useState<'escuro' | 'claro'>('escuro');
  const [folha, setFolha] = useState(false);
  const [dia, setDia] = useState<'a' | 'b' | 'c'>('a');

  useEffect(() => {
    // A página liga o tema no <html> e DESLIGA ao sair: é vitrine, não preferência do app.
    const raiz = document.documentElement;
    if (tema === 'claro') raiz.setAttribute('data-tema', 'claro');
    else raiz.removeAttribute('data-tema');
    return () => raiz.removeAttribute('data-tema');
  }, [tema]);

  if (profile && profile.role !== 'master') notFound();
  if (!profile) return null;

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto ${RODAPE_SEGURO} space-y-8`}>
      <header className="space-y-3">
        <h1 className="font-outfit text-3xl font-bold text-foreground">Sistema visual</h1>
        <p className="text-sm text-foreground-muted">
          Vitrine temporária. Troque o tema e confira no celular.
        </p>
        <Segmentado
          aria-label="Tema"
          valor={tema}
          onMudar={setTema}
          opcoes={[
            { valor: 'escuro', rotulo: 'Escuro' },
            { valor: 'claro', rotulo: 'Claro' },
          ]}
        />
      </header>

      <Secao titulo="Cor">
        <div className="grid grid-cols-2 gap-2">
          <Amostra nome="background" classe="bg-background border border-border" />
          <Amostra nome="surface" classe="bg-surface" />
          <Amostra nome="surface-light" classe="bg-surface-light" />
          <Amostra nome="primary 9,85" classe="bg-primary" />
          <Amostra nome="accent 6,29" classe="bg-accent" />
          <Amostra nome="destructive 6,14" classe="bg-destructive" />
        </div>
        <p className="text-micro text-foreground-subtle">
          foreground 17,34 · muted 7,25 · subtle 4,05 — contraste medido sobre o fundo.
        </p>
      </Secao>

      <Secao titulo="Texto">
        <p className="font-outfit text-3xl font-bold text-foreground">Outfit, título 3xl</p>
        <p className="text-base text-foreground">Inter, corpo base</p>
        <p className="text-sm text-foreground-muted">Inter, apoio sm em muted</p>
        <p className="text-micro text-foreground-muted">micro 11px — meta de lista</p>
        <p className="text-nano font-bold uppercase tracking-wider text-foreground-subtle">
          nano 10px maiúscula — rótulo
        </p>
        <p className="text-4xl font-bold tabular-nums text-foreground">42,5 kg · 12 reps</p>
      </Secao>

      <Secao titulo="Botão">
        <div className="flex flex-wrap gap-2">
          <Button>Principal</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger">Perigo</Button>
          <Button size="sm">Pequeno</Button>
        </div>
        <Button fullWidth size="lg">Iniciar treino</Button>
      </Secao>

      <Secao titulo="Selo">
        <div className="flex flex-wrap gap-2">
          <Badge>neutro</Badge>
          <Badge tom="primario">treinando agora</Badge>
          <Badge tom="destaque">bi-set</Badge>
          <Badge tom="atencao">c/ aquecimento</Badge>
          <Badge tom="perigo">banido</Badge>
        </div>
      </Secao>

      <Secao titulo="Progresso">
        <BarraDeProgresso valor={62} aria-label="Ciclo" />
        <div className="flex gap-4 items-center">
          <AnelDeProgresso valor={66} aria-label="Séries">2/3</AnelDeProgresso>
          <AnelDeProgresso valor={100} aria-label="Séries">3/3</AnelDeProgresso>
          <AnelDeProgresso valor={0} aria-label="Séries">0/4</AnelDeProgresso>
        </div>
      </Secao>

      <Secao titulo="Segmentado">
        <Segmentado
          aria-label="Dia"
          valor={dia}
          onMudar={setDia}
          opcoes={[
            { valor: 'a', rotulo: 'Treino A' },
            { valor: 'b', rotulo: 'Treino B' },
            { valor: 'c', rotulo: 'Treino C' },
          ]}
        />
      </Secao>

      <Secao titulo="Linha de lista">
        <Card className="px-4">
          <LinhaDeLista
            midia={<Dumbbell className="w-6 h-6 text-foreground-subtle" aria-hidden="true" />}
            selo={<Badge tom="atencao">c/ aquecimento</Badge>}
            titulo="Supino inclinado com halteres"
            meta="4 séries · 10 reps · 28 kg"
            acao={<MoreVertical className="w-4 h-4 text-foreground-muted" aria-hidden="true" />}
            onClick={() => {}}
          />
          <LinhaDeLista
            midia={<ImageOff className="w-5 h-5 text-foreground-subtle/50" aria-hidden="true" />}
            titulo="Crucifixo na polia"
            meta="3 séries · 12 reps"
            acao={<Timer className="w-4 h-4 text-foreground-muted" aria-hidden="true" />}
            onClick={() => {}}
          />
        </Card>
      </Secao>

      <Secao titulo="Entrada">
        <Input placeholder="Carga em kg" />
        <Input placeholder="Com erro" invalid />
      </Secao>

      <Secao titulo="Cartão">
        <Card className="p-4">
          <p className="text-sm text-foreground">Cartão padrão</p>
        </Card>
        <Card variant="glass" className="p-4">
          <p className="text-sm text-foreground">Cartão de vidro</p>
        </Card>
      </Secao>

      <Secao titulo="Carregando e vazio">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <EmptyState
          icone={<Dumbbell className="w-7 h-7" aria-hidden="true" />}
          titulo="Nenhum treino ainda"
          descricao="Gere o primeiro plano para começar a registrar carga."
        />
      </Secao>

      <Secao titulo="Folha inferior">
        <Button variant="outline" onClick={() => setFolha(true)}>Abrir folha</Button>
        <FolhaInferior
          aberta={folha}
          aoFechar={() => setFolha(false)}
          titulo="Trocar exercício"
          descricao="Escolha outro que trabalhe o mesmo grupo e caiba no seu equipamento."
        >
          <Button fullWidth onClick={() => setFolha(false)}>Entendi</Button>
        </FolhaInferior>
      </Secao>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-nano font-bold uppercase tracking-wider text-foreground-subtle">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Amostra({ nome, classe }: { nome: string; classe: string }) {
  return (
    <div className="rounded-sm overflow-hidden">
      <div className={`h-12 ${classe}`} />
      <p className="text-nano text-foreground-muted mt-1">{nome}</p>
    </div>
  );
}
