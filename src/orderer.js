import { providers } from "ethers";

import { sendRawSignedTransaction } from "./utils/queue";

export function Orderer(name, from_address, rpc_url) {
  const self = this;

  self.name = name;
  self.from_address = from_address;
  self.rpc_url = rpc_url;

  self.provider = new providers.JsonRpcProvider(self.rpc_url);

  self.provider.getNetwork().then(network => {
    self.chain_id = network.chainId;
  });

  self.nonce = 0;

  self.getNonce = async function() {
    self.nonce = await self.provider.getTransactionCount(
      self.from_address,
      "pending"
    );
  };

  self.setNonce = async function(nonce) {
    self.nonce = nonce;
  };

  self.increaseNonce = function() {
    self.nonce = self.nonce + 1;
  };

  self.sendTransaction = async function(rawSignedTx) {
    return await sendRawSignedTransaction(rawSignedTx);
  };

  self.sendTransactionAfterAnotherTransaction = async function(
    dependingTxHash,
    rawSignedTx
  ) {
    await sendRawSignedTransaction(rawSignedTx, dependingTxHash);
  };
}
