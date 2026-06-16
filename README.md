# Novo Gantt

Grafico de Gantt para o sequenciamento de producao retornado pela API de snaps.

## Rodar

```bash
npm start
```

Se a porta `5173` estiver ocupada:

```bash
PORT=5174 npm start
```

Acesse `http://127.0.0.1:5174`.

## Dados

O servidor local faz proxy para:

```text
http://10.147.18.141:3020/snaps/6ad40ca227812456c8b48b03147df9e6b7db1c498eb30f1cd4f2ba00b70beeb0?page=1&size=9999
```

Tambem busca o cadastro de maquinas em:

```text
http://10.147.18.141:3000/octopus/recurso
```

Variaveis aceitas:

- `PORT`: porta do servidor local.
- `HOST`: host do servidor local.
- `API_BASE`: origem da API, por padrao `http://10.147.18.141:3020`.
- `RESOURCE_API_BASE`: origem da API de maquinas, por padrao `http://10.147.18.141:3000`.
- `SNAP_ID`: id do snap.

## Regras do Gantt

- Cada linha representa um equipamento/maquina.
- Cada bloco representa um processo do pedido, usando `start` e `end`.
- Maquinas do mesmo setor aparecem agrupadas uma abaixo da outra.
- Processos do mesmo `packref` usam a mesma cor, mesmo envolvendo varios pedidos e maquinas diferentes.
- O filtro `Packref` permite isolar somente os processos daquele encadeamento.
- Se dois processos sobrepoem horario na mesma maquina, os blocos ficam destacados como conflito.
- Ao passar o mouse sobre um bloco, a tela mostra pedido, packref, produto, workflow, operacao, maquina, horarios, prazo e roteiro completo do packref.
- Como o payload atual nao possui campo de quantidade, a tela mostra produto, operacao, setor, equipamento e duracao.

## Performance

- Renderizacao virtualizada: somente as linhas visiveis entram no DOM.
- Busca com debounce para reduzir renderizacoes durante digitacao.
- Filtros aplicados antes da montagem dos blocos.
- Eixo de tempo recalculado para o recorte filtrado.
