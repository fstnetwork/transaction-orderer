import { Wallet } from "ethers";

import { Orderer } from "./orderer";

export function Signer(name, private_key, rpc_url) {
  const self = this;

  self.wallet = new Wallet(private_key);

  self.name = name;
  self.private_key = private_key;
  self.rpc_url = rpc_url;

  self.from_address = self.wallet.address;

  self.orderer = new Orderer(self.name, self.from_address, self.rpc_url);

  self.sendTransaction = async function({
    to,
    gasPrice,
    gasLimit,
    data,
    value
  }) {};
}
