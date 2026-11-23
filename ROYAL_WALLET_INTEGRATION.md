# Carteira Royal — integração com pagamento futuro

## Estado implementado

A versão atual trabalha **somente com fichas virtuais do Poker Royale**.

- Saldo disponível: `users.wallet`, usado pelos buy-ins existentes.
- Saldo reservado: `users.walletReserved`, descontado do saldo disponível na solicitação.
- Fichas em mesas: soma dos assentos atuais do jogador.
- Solicitações: `walletRequests` dentro de `pokeroyale_private.pokeroyale_records`, com `kind=walletRequests`, protegidas pelo serviço.
- Extrato já existente: `walletHistory`, gerado a partir de alterações na carteira.
- Pedidos de resgate: `pending -> approved -> completed` ou `pending/approved -> rejected`; devolução idempotente ao rejeitar.
- Depósitos: somente intenção `awaiting_provider`; **não** geram QR Code, saldo ou confirmação.
- Painel administrativo protegido por sessão autenticada, papel admin e senha secundária.
- Não existem transações bancárias, conversão para BRL ou Pix habilitados.

## Integração Pix futura

Antes de qualquer ativação:
1. Verificar a elegibilidade legal e regulatória de operações financeiras relacionadas a poker com taxa de rake, incluindo provedores de pagamento.
2. Aprovar fornecedor de pagamentos com ambiente de homologação, autenticação e webhooks assinados.
3. Configurar exclusivamente no Render os segredos do provedor; não usar variáveis `VITE_*` para chaves privadas.
4. Registrar cobranças `providerChargeId`, expiração, valor em centavos, status de pagamento e confirmação verificável, com unicidade por referência externa.
5. Validar assinatura de webhook e consultar o status oficial no provedor antes de creditar saldo, com idempotência transacional e auditoria.
6. Vincular unidades de fichas e BRL somente depois de uma regra de conversão aprovada e documentada. **Não** permitir saque das fichas de teste concedidas na criação de conta.
7. Guardar dados Pix com minimização e tratamento seguro; aprovar saques com autenticação forte, dupla conferência e registro da evidência de pagamento.
8. Conciliar diariamente caixa e movimentações, tratar chargebacks, reversões, fraudes, KYC e limites operacionais.

A interface atual NÃO declara que pagamento foi confirmado. Nunca marcar um pedido como Pix pago apenas por informação enviada pelo jogador.

## Testes

`node --test tests/royale-wallet-workflow.test.mjs`

Os testes verificam reserva, ausência de saldo duplicado, idempotência, devolução de rejeições, encerramento e que intenções de depósito não creditam fichas.
