import { Mppx as Server, tempo as serverTempo } from 'mppx/server';
import { Mppx as Client, tempo as clientTempo } from 'mppx/client';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, CURRENCY, testnetResolver } from './config.mjs';

export function createPayments(config, store) {
  const getClient = testnetResolver();
  const server = Server.create({
    realm: 'barra-testnet', secretKey: config.secretKey,
    methods: [serverTempo.charge({
      testnet: true, chainId: CHAIN_ID, currencies: [CURRENCY],
      recipient: config.recipient, getClient, store, waitForConfirmation: true,
    })],
  });
  const client = config.privateKey ? Client.create({
    polyfill: false,
    methods: [clientTempo.charge({
      account: privateKeyToAccount(config.privateKey), getClient,
      allowedChainIds: [CHAIN_ID], expectedChainId: CHAIN_ID,
      currencies: [CURRENCY], expectedRecipients: [config.recipient],
      maxAtomicAmount: String(config.maxPerQuoteMicros), autoSwap: false, mode: 'pull',
    })],
  }) : null;
  return { server, client };
}
