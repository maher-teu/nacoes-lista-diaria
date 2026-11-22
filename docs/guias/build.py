"""Gera os guias (Dona e Loja) em HTML e PDF."""
import asyncio, pathlib, base64
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
SH = ROOT / 'shots'
LINK = 'nacoes-lista-diaria.vercel.app'

def img(name, w='62%'):
    data = base64.b64encode((SH / f'{name}.png').read_bytes()).decode()
    return f'<div class="shot" style="width:{w}"><img src="data:image/png;base64,{data}"></div>'

CSS = """
@page { size: 148mm 210mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; color: #1c1f1d; background: #f6f5f1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 148mm; height: 210mm; padding: 13mm 12mm 11mm; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; gap: 4.2mm; }
.page:last-child { page-break-after: auto; }
.cover { background: #1d6b4d; color: #fff; justify-content: center; gap: 6mm; }
.cover .tag { display: inline-block; background: #f2b84b; color: #1c1f1d; font-weight: 800; font-size: 11pt; padding: 2mm 4mm; border-radius: 99px; align-self: flex-start; }
.cover h1 { font-size: 34pt; line-height: 1.05; font-weight: 800; letter-spacing: -0.5px; }
.cover p { font-size: 14pt; line-height: 1.4; opacity: .92; }
.cover .small { font-size: 11pt; opacity: .8; margin-top: 8mm; }
.kicker { font-size: 9.5pt; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #1d6b4d; }
h2 { font-size: 20pt; line-height: 1.15; font-weight: 800; letter-spacing: -0.3px; }
p, li { font-size: 12.5pt; line-height: 1.45; }
.steps { display: flex; flex-direction: column; gap: 3mm; }
.step { display: flex; gap: 3mm; align-items: flex-start; }
.num { flex: none; width: 8mm; height: 8mm; border-radius: 50%; background: #1d6b4d; color: #fff; font-weight: 800; font-size: 11pt; display: flex; align-items: center; justify-content: center; margin-top: .3mm; }
.step p { flex: 1; }
b { font-weight: 800; }
.btn { display: inline-block; background: #1d6b4d; color: #fff; font-weight: 800; padding: .4mm 2.2mm; border-radius: 1.6mm; font-size: 11pt; white-space: nowrap; }
.btn.o { background: #fff; color: #1c1f1d; border: .3mm solid #c9c7bf; }
.btn.l { background: transparent; color: #1d6b4d; padding: 0; }
.shot { align-self: center; border-radius: 4mm; overflow: hidden; border: .35mm solid #dedcd4; background: #fff; box-shadow: 0 1.5mm 5mm rgba(0,0,0,.08); flex: none; }
.shot img { width: 100%; display: block; }
.row { display: flex; gap: 4mm; align-items: flex-start; }
.row .shot { align-self: flex-start; }
.tip { background: #fff; border: .3mm solid #e4e2da; border-left: 1.6mm solid #f2b84b; border-radius: 2.5mm; padding: 3mm 3.5mm; }
.tip p { font-size: 11.5pt; }
.warn { border-left-color: #c0392b; }
.big { font-size: 15pt; line-height: 1.4; }
.footer { position: absolute; bottom: 6mm; left: 12mm; right: 12mm; font-size: 8.5pt; color: #8a8d88; display: flex; justify-content: space-between; }
ul.check { list-style: none; display: flex; flex-direction: column; gap: 2.4mm; }
ul.check li { padding-left: 7mm; position: relative; }
ul.check li::before { content: "✓"; position: absolute; left: 0; top: 0; color: #1d6b4d; font-weight: 900; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.box { background: #fff; border: .3mm solid #e4e2da; border-radius: 3mm; padding: 3mm; }
.box b { display: block; font-size: 12pt; margin-bottom: 1mm; }
.box p { font-size: 11pt; line-height: 1.35; }
"""

def page(body, n=None, total=None, label=''):
    foot = f'<div class="footer"><span>{label}</span><span>{n}/{total}</span></div>' if n else ''
    return f'<section class="page">{body}{foot}</section>'

def steps(*items):
    return '<div class="steps">' + ''.join(f'<div class="step"><span class="num">{i+1}</span><p>{t}</p></div>' for i, t in enumerate(items)) + '</div>'

# ---------------------------------------------------------------- Guia da Dona
def dona():
    P = []
    P.append(('cover', f'''
      <span class="tag">Guia da Dona</span>
      <h1>Lista do Dia<br>Baummer Nações</h1>
      <p>Todo dia, às 7 da manhã, o app separa as clientes certas e escreve a mensagem para cada uma.</p>
      <p>A loja só toca, envia e marca. Você acompanha tudo.</p>
      <p class="small">Leva 10 minutos para ler. Guarde este guia no celular.</p>'''))
    P.append(f'''
      <span class="kicker">Começo</span><h2>O que o app faz por você</h2>
      <div class="grid">
        <div class="box"><b>🌅 7:00</b><p>O app escolhe 50 clientes do dia: aniversário, quem sumiu, quem comprou no Natal passado, quem pode completar um conjunto.</p></div>
        <div class="box"><b>✍️ 7:05</b><p>A IA escreve uma mensagem para cada uma, com uma peça do seu catálogo da semana e o motivo da escolha.</p></div>
        <div class="box"><b>📱 Durante o dia</b><p>A loja abre o app, toca no WhatsApp, envia e marca. Uma cliente de cada vez.</p></div>
        <div class="box"><b>📊 Você</b><p>Sobe o catálogo uma vez por semana e olha os números em Resultados.</p></div>
      </div>
      <div class="tip"><p><b>Você só tem 2 tarefas:</b> subir o catálogo toda semana e conferir se a loja enviou as mensagens do dia.</p></div>''')
    P.append(f'''
      <span class="kicker">Passo 1</span><h2>Entrar no app</h2>
      <div class="row">{img('01b_login_dona_c', '46%')}
      {steps(f'Abra <b>{LINK}</b> no celular.', 'Toque em <b>Dona</b>.', 'Digite a sua senha e toque em <span class="btn">Entrar</span>.', 'Quando o celular perguntar <b>“Salvar senha?”</b>, toque em <b>Sim</b>.')}</div>
      <div class="tip"><p><b>Deixe o app na tela do celular, como um aplicativo:</b><br>iPhone: botão Compartilhar ⬆️ → <b>Adicionar à Tela de Início</b>.<br>Android: menu ⋮ → <b>Adicionar à tela inicial</b>.</p></div>
      <p>Você fica conectada. Só precisa da senha de novo se trocar de celular.</p>''')
    P.append(f'''
      <span class="kicker">A tela principal</span><h2>Hoje: o trabalho do dia</h2>
      {img('02_top_c', '74%')}
      <div class="grid">
        <div class="box"><b>Novos</b><p>As mensagens do dia. A primeira que a loja manda para cada cliente.</p></div>
        <div class="box"><b>Lembretes</b><p>4 horas depois: quem não respondeu recebe um lembrete curtinho.</p></div>
        <div class="box"><b>Follow-ups</b><p>Quem respondeu recebe mensagem de novo a cada 2 dias, até comprar.</p></div>
        <div class="box"><b>Feitos hoje</b><p>A barra verde enche conforme a loja trabalha. No fim do dia, cheia.</p></div>
      </div>''')
    P.append(f'''
      <span class="kicker">Como a loja envia</span><h2>Uma mensagem nova</h2>
      <div class="row">{img('03_card', '42%')}
      {steps('A <b>peça sugerida</b> vem do seu catálogo. A IA escolheu pelo que a cliente já comprou.', 'A <b>mensagem pronta</b> pode ser mudada antes de enviar. É só tocar no texto.', 'Toque em <span class="btn">Abrir no WhatsApp</span>. A conversa abre com a mensagem escrita. Toque em enviar.', 'Volte ao app e toque em <span class="btn">Sim, enviei</span>. Aparece a próxima cliente.')}</div>''')
    P.append(f'''
      <span class="kicker">Como a loja envia</span><h2>Lembrete e resposta</h2>
      <div class="row">{img('07_lembrete', '48%')}
      {steps('Depois de 4 horas, a cliente aparece em <b>Lembretes</b>.', 'Não respondeu? Toque em <span class="btn">Não, mandar lembrete</span> e envie.', 'Respondeu? Toque em <span class="btn o">Sim, respondeu</span> e escolha o que ela disse.', 'Ela quer ver? Toque em <span class="btn o">📸 Enviar foto da peça</span> e mande a foto no WhatsApp.')}</div>''')
    P.append(f'''
      <span class="kicker">Como a loja envia</span><h2>Follow-ups até vender</h2>
      <div class="row">{img('09_follow', '48%')}
      {steps('Quem respondeu volta a aparecer a cada 2 dias, com uma mensagem nova pronta.', 'Comprou? Toque em <span class="btn o">Comprou</span> e coloque o valor, se souber.', 'A conversa acabou? Toque em <span class="btn o">Encerrar conversa</span>.', 'Pediu para parar? Toque em <b style="color:#c0392b">Não quer mais</b>. O app nunca mais chama essa cliente.')}</div>''')
    P.append(f'''
      <span class="kicker">Errou? Tudo bem</span><h2>Pular e desfazer</h2>
      <div class="row">{img('06_skip', '48%')}
      {steps('Número errado ou já estão conversando? Toque em <span class="btn l">Pular esta</span> e escolha o motivo.', 'Tocou no botão errado? Aparece <b>Desfazer</b> embaixo da tela por alguns segundos. Toque nele.', 'Na lista <b>Feitos hoje</b> também tem <span class="btn l">Desfazer</span> ao lado de cada cliente.')}</div>
      <div class="tip"><p>Nada no app apaga cliente. Dá sempre para voltar atrás.</p></div>''')
    P.append(f'''
      <span class="kicker">Clientes</span><h2>Achar qualquer cliente</h2>
      <div class="row">{img('11_ficha', '50%')}
      {steps('Toque em <b>Clientes</b>, embaixo.', 'Digite o nome ou o telefone.', 'Toque na cliente para ver a <b>ficha</b>: o que comprou, quanto gastou, aniversário e as mensagens já enviadas.', 'Daqui dá para abrir a conversa no WhatsApp ou colocar a cliente na lista de hoje.')}</div>''')
    P.append(f'''
      <span class="kicker">Toda semana · sua tarefa</span><h2>Subir o catálogo</h2>
      <div class="row">{img('13_res_3', '50%')}
      {steps('Domingo à noite, de preferência. Use Wi-Fi.', 'Toque em <b>Resultados</b>, embaixo, e desça até <b>Catálogo da semana</b>.', 'Toque em <span class="btn">📸 Adicionar fotos ou PDF</span> e escolha o PDF da semana.', 'Espere aparecer <b>“Catálogo pronto”</b>. Leva poucos minutos. Não feche o app enquanto isso.')}</div>
      <div class="tip"><p><b>O catálogo novo apaga o antigo.</b> As mensagens passam a sugerir só peças que você tem agora.</p></div>''')
    P.append(f'''
      <span class="kicker">Quando quiser · campanhas</span><h2>Frase da campanha</h2>
      <div class="row">{img('13_res_4', '50%')}
      <div style="flex:1;display:flex;flex-direction:column;gap:3mm">
      <p>Tem promoção ou novidade? Escreva uma frase em <b>Frase da campanha</b> e toque em <span class="btn">Salvar ajustes</span>.</p>
      <p>A IA coloca essa ideia nas mensagens a partir da próxima lista.</p>
      <div class="tip"><p>Exemplo: “Até o dia 24 a embalagem de presente é por nossa conta.”</p></div>
      <p><b>Acabou a campanha? Apague a frase.</b> O app nunca inventa promoção. Só usa o que você escreve aqui.</p></div></div>''')
    P.append(f'''
      <span class="kicker">Todo dia · sua tarefa</span><h2>Conferir os Resultados</h2>
      <div class="row">{img('13_res_0', '46%')}{img('13_res_1', '46%')}</div>
      <ul class="check">
        <li><b>Mensagens novas</b>: no fim do dia deve estar perto de 50. Se estiver baixo, a loja não enviou.</li>
        <li><b>Responderam e Venderam</b>: mostram se as mensagens estão trazendo clientes.</li>
        <li><b>Últimos 7 dias</b>: um dia com 0 enviadas é um dia perdido. Converse com a equipe.</li>
      </ul>''')
    P.append(f'''
      <span class="kicker">Se algo der errado</span><h2>Perguntas rápidas</h2>
      <div class="box"><b>A lista não apareceu.</b><p>Ela sai às 7h. Se depois das 7h10 ainda estiver vazia, entre como Dona e toque em <span class="btn">Gerar a lista agora</span> na tela Hoje. Espere a bolinha girar até terminar.</p></div>
      <div class="box"><b>A peça sugerida acabou na loja.</b><p>A loja pode mudar a mensagem antes de enviar. Para não acontecer, suba o catálogo novo toda semana.</p></div>
      <div class="box"><b>Saí do app sem querer.</b><p>Entre de novo. O celular preenche a senha sozinho.</p></div>
      <div class="box"><b>Troquei de celular.</b><p>Abra o link, toque em Dona e digite a senha uma vez.</p></div>''')
    P.append(f'''
      <span class="kicker">Para lembrar</span><h2>Regras de ouro</h2>
      <ul class="check">
        <li class="big">Todo dia, as 3 abas zeradas: Novos, Lembretes e Follow-ups.</li>
        <li class="big">Enviou no WhatsApp? Marca no app na hora.</li>
        <li class="big">Cliente respondeu? Responda rápido. Quem responde rápido vende.</li>
        <li class="big">Pediu para parar? <b>Não quer mais</b>. Sempre.</li>
        <li class="big">Catálogo novo toda semana, domingo à noite.</li>
      </ul>''')
    return P, 'Guia da Dona · Lista do Dia'

# ---------------------------------------------------------------- Guia da Loja
def loja():
    P = []
    P.append(('cover', f'''
      <span class="tag">Guia da Loja</span>
      <h1>Lista do Dia<br>Baummer Nações</h1>
      <p>Todo dia o app te dá as clientes e a mensagem pronta.</p>
      <p>Você só faz 3 coisas: <b>abrir, enviar e marcar.</b></p>
      <p class="small">5 minutos para ler. Depois é só seguir o app.</p>'''))
    P.append(f'''
      <span class="kicker">Uma vez só</span><h2>Entrar no app</h2>
      <div class="row">{img('01_login_c', '46%')}
      {steps(f'No celular da loja, abra <b>{LINK}</b>.', 'Toque em <b>Loja</b>.', 'Digite a senha que a dona te passou e toque em <span class="btn">Entrar</span>.', 'O celular pergunta <b>“Salvar senha?”</b>. Toque em <b>Sim</b>.')}</div>
      <div class="tip"><p><b>Coloque o app na tela do celular:</b><br>iPhone: Compartilhar ⬆️ → <b>Adicionar à Tela de Início</b>.<br>Android: menu ⋮ → <b>Adicionar à tela inicial</b>.</p></div>''')
    P.append(f'''
      <span class="kicker">Todo dia</span><h2>Seu trabalho cabe em 3 abas</h2>
      {img('02_top_c', '74%')}
      <ul class="check">
        <li class="big"><b>Novos</b>: mensagens do dia. Comece por aqui.</li>
        <li class="big"><b>Lembretes</b>: quem ainda não respondeu.</li>
        <li class="big"><b>Follow-ups</b>: quem já respondeu.</li>
      </ul>
      <div class="tip"><p>Terminou quando as 3 abas mostram <b>0</b> e a barra verde está cheia.</p></div>''')
    P.append(f'''
      <span class="kicker">Novos · repita para cada cliente</span><h2>Enviar uma mensagem</h2>
      <div class="row">{img('03_card', '42%')}
      {steps('Leia a mensagem. Se quiser, toque no texto e mude.', 'Toque em <span class="btn">Abrir no WhatsApp</span>.', 'No WhatsApp, a mensagem já está escrita. Toque em <b>enviar</b>.', 'Volte para o app.')}</div>''')
    P.append(f'''
      <span class="kicker">Novos · repita para cada cliente</span><h2>Marcar que enviou</h2>
      {img('04_confirm', '70%')}
      {steps('Toque em <span class="btn">Sim, enviei</span>.', 'Pronto. A próxima cliente aparece sozinha.', 'Repita até a aba <b>Novos</b> chegar a 0.')}
      <div class="tip warn"><p><b>Sempre marque.</b> Se não marcar, o app não sabe que você enviou e não manda o lembrete.</p></div>''')
    P.append(f'''
      <span class="kicker">Lembretes · à tarde</span><h2>Ela respondeu?</h2>
      <div class="row">{img('07_lembrete', '48%')}
      {steps('4 horas depois, a cliente aparece em <b>Lembretes</b>.', 'Olhe no WhatsApp se ela respondeu.', 'Não respondeu: toque em <span class="btn">Não, mandar lembrete</span>, depois envie e marque.', 'Respondeu: toque em <span class="btn o">Sim, respondeu</span>.')}</div>''')
    P.append(f'''
      <span class="kicker">Lembretes · à tarde</span><h2>O que ela disse?</h2>
      <div class="row">{img('08_reply', '50%')}
      {steps('Toque na resposta dela.', 'Quer ver a peça? Toque em <span class="btn o">📸 Enviar foto da peça</span> e mande no WhatsApp.', 'Ela vai aparecer em <b>Follow-ups</b> para você continuar a conversa.', 'Pediu para parar? Toque em <b style="color:#c0392b">Não quer mais mensagens</b>.')}</div>''')
    P.append(f'''
      <span class="kicker">Follow-ups</span><h2>Continuar até vender</h2>
      <div class="row">{img('09_follow', '48%')}
      {steps('A mensagem já vem pronta. Envie igual: <span class="btn">Abrir no WhatsApp</span> → enviar → <span class="btn">Sim, enviei</span>.', 'Comprou? Toque em <span class="btn o">Comprou</span>.', 'Não quer agora? <span class="btn o">Encerrar conversa</span>.', 'Não quer mais mensagens? <b style="color:#c0392b">Não quer mais</b>.')}</div>''')
    P.append(f'''
      <span class="kicker">Errou? Tudo bem</span><h2>Pular e desfazer</h2>
      <div class="row">{img('06_skip', '48%')}
      {steps('Número errado? Já estão conversando? Toque em <span class="btn l">Pular esta</span> e escolha o motivo.', 'Tocou errado? Toque em <b>Desfazer</b>, que aparece embaixo da tela.', 'Cliente chegou na loja ou chamou no WhatsApp? Use <b>Clientes</b>, busque o nome e veja a ficha dela.')}</div>''')
    P.append(f'''
      <span class="kicker">Resumo</span><h2>Todo dia, sem falta</h2>
      <ul class="check">
        <li class="big"><b>Manhã:</b> aba Novos até 0.</li>
        <li class="big"><b>Tarde:</b> aba Lembretes até 0.</li>
        <li class="big"><b>Sempre que der:</b> aba Follow-ups até 0.</li>
        <li class="big">Enviou? <b>Marca na hora.</b></li>
        <li class="big">Respondeu? <b>Responda rápido.</b></li>
        <li class="big">Pediu para parar? <b>Não quer mais.</b></li>
      </ul>
      <div class="tip"><p>A dona vê no app quantas mensagens foram enviadas todo dia.</p></div>''')
    return P, 'Guia da Loja · Lista do Dia'

def build(pages, label):
    total = len(pages)
    out = []
    for i, p in enumerate(pages, 1):
        if isinstance(p, tuple):
            out.append(f'<section class="page cover">{p[1]}</section>')
        else:
            out.append(page(p, i, total, label))
    return f'<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>{label}</title><style>{CSS}</style></head><body>{"".join(out)}</body></html>'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for fn, name in ((dona, 'Guia-da-Dona'), (loja, 'Guia-da-Loja')):
            pages, label = fn()
            html = build(pages, label)
            (ROOT / f'{name}.html').write_text(html)
            pg = await b.new_page()
            await pg.goto((ROOT / f'{name}.html').as_uri()); await pg.wait_for_timeout(500)
            await pg.pdf(path=str(ROOT / f'{name}.pdf'), width='148mm', height='210mm', print_background=True)
            # checa se algo transbordou da página
            over = await pg.evaluate("[...document.querySelectorAll('.page')].map((s,i)=>[i+1, s.scrollHeight - s.clientHeight]).filter(x=>x[1]>2)")
            print(name, 'overflow:', over)
        await b.close()

asyncio.run(main())
