"""Roteiro da narração, cena por cena. Cada parte vira um arquivo de voz."""
SCENES = [
    # (id, parte, texto, duração estimada em segundos)
    ('A', 1, 'Esta é a Lista do Dia da Baummer Nações.', 4.0),
    ('B', 1, 'Todo dia, às sete da manhã, o app escolhe cinquenta clientes: quem faz aniversário, quem sumiu e quem comprou no Natal passado.', 8.5),
    ('C', 1, 'E a inteligência artificial escreve uma mensagem para cada uma, com uma peça do catálogo da semana e o motivo da escolha.', 8.0),
    ('D', 1, 'Para entrar, toque em Loja ou Dona, digite a senha e deixe o celular salvar.', 6.0),
    ('E', 1, 'Na tela Hoje, todo o trabalho está em três abas: Novos, Lembretes e Follow-ups.', 6.0),
    ('F', 2, 'Em Novos, leia a mensagem, ajuste se quiser e toque em Abrir no WhatsApp. Envie, volte e toque em Sim, enviei. A próxima cliente aparece sozinha.', 10.5),
    ('G', 2, 'Quatro horas depois, ela aparece em Lembretes. Não respondeu? Mande o lembrete. Respondeu? Marque o que ela disse e envie a foto da peça.', 10.0),
    ('H', 2, 'Quem responde vai para Follow-ups e recebe uma mensagem nova a cada dois dias, até comprar. Comprou? Toque em Comprou.', 8.5),
    ('I', 2, 'Número errado? Toque em Pular. Tocou errado? Desfazer.', 4.5),
    ('J', 3, 'Na aba Clientes fica o funil: todas as clientes, separadas por etapa. Toque numa etapa para ver quem está nela.', 8.0),
    ('K', 3, 'Ou busque pelo nome e abra a ficha: o que ela comprou, o aniversário e cada mensagem enviada.', 7.0),
    ('L', 4, 'Toda semana, a dona sobe o PDF do catálogo. O novo substitui o antigo, e as mensagens só sugerem o que tem na loja.', 8.5),
    ('M', 4, 'Tem promoção? Ela escreve a frase da campanha, e a inteligência artificial coloca essa ideia nas mensagens novas. Acabou? É só apagar.', 9.5),
    ('N', 4, 'Em Resultados, ela vê quantas mensagens saíram, quem respondeu e quanto vendeu.', 6.0),
    ('O', 4, 'Se a lista não aparecer às sete, é só tocar em Gerar a lista agora.', 5.0),
    ('P', 4, 'A regra é simples: todo dia, as três abas zeradas. Boas vendas!', 6.5),
]
INSTRUCTIONS = ('Fale em português do Brasil, com sotaque brasileiro natural. Voz feminina, calorosa e alegre, '
                'como uma apresentadora explicando algo fácil para uma amiga. Ritmo tranquilo e claro, '
                'pausa curta entre os parágrafos, sorriso na voz.')

if __name__ == '__main__':
    for part in (1, 2, 3, 4):
        print(f'===== PARTE {part} =====')
        print('\n\n'.join(t for _, p, t, _ in SCENES if p == part))
        print()
    print('Total estimado:', sum(d for *_, d in SCENES), 's')
