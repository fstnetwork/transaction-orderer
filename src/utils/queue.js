import Queue from "bull";

import Axios from "axios";

import { utils } from "ethers";

import { redis } from "./redis";

export const endpoint = "https://api.staging.fst.network/ethereum/jsonrpc-http";

let _id = 0n;
function nextId() {
  _id = _id + 1n;
  return _id.toString();
}

export const transactionQueue = new Queue("Transaction Queue", {
  limiter: { max: 1000, duration: 5000 },
  redis
});

export async function sendRawSignedTransaction(
  rawSignedTransaction,
  dependingTransactionHash
) {
  try {
    if (dependingTransactionHash) {
      await transactionQueue.add(
        "awaitTransactionJob",
        {
          dependingTransactionHash,
          awaitingRawSignedTx: rawSignedTransaction
        },
        { removeOnComplete: true }
      );
    } else {
      await transactionQueue.add(
        "sendTransactionJob",
        { rawSignedTx: rawSignedTransaction },
        { removeOnComplete: true }
      );
    }
  } catch (err) {
    console.error(err);
  }

  return true;
}

async function sendTransactionJob(job, done) {
  try {
    const rawSignedTx = job.data.rawSignedTx;

    const { data: eth_sendRawTransaction_data } = await Axios({
      method: "post",
      baseURL: endpoint,
      data: {
        method: "eth_sendRawTransaction",
        params: [rawSignedTx],
        id: nextId(),
        jsonrpc: "2.0"
      }
    });

    const parsedTransaction = utils.parseTransaction(rawSignedTx);

    await job.progress(50);

    await job.update({
      ...job.data,
      eth_sendRawTransaction_data,
      parsedTransaction
    });

    await transactionQueue.add("checkTransactionJob", job.data, {
      removeOnComplete: true
    });

    await job.progress(100);

    done(null, `sendTransactionJob for ${parsedTransaction.hash} done`);
  } catch (err) {
    done(err);
  }
}

async function checkTransactionJob(job, done) {
  try {
    const txhash = job.data.parsedTransaction.hash;

    const { data: eth_getTransactionByHash_data } = await Axios({
      method: "post",
      baseURL: endpoint,
      data: {
        method: "eth_getTransactionByHash",
        params: [txhash],
        id: nextId(),
        jsonrpc: "2.0"
      }
    });

    await job.progress(50);

    await job.update({ ...job.data, eth_getTransactionByHash_data });

    await job.progress(100);

    done(null, `checkTransactionJob for ${txhash} done`);
  } catch (err) {
    done(err);
  }
}

async function awaitTransactionJob(job, done) {
  try {
    const txhash = job.data.dependingTransactionHash;
    const awaitingRawSignedTx = job.data.awaitingRawSignedTx;

    const {
      data: depending_transaction_eth_getTransactionReceipt_data
    } = await Axios({
      method: "post",
      baseURL: endpoint,
      data: {
        method: "eth_getTransactionReceipt",
        params: [txhash],
        id: nextId(),
        jsonrpc: "2.0"
      }
    });

    await job.progress(50);

    await job.update({
      ...job.data,
      depending_transaction_eth_getTransactionReceipt_data
    });

    await transactionQueue.add(
      "sendTransactionJob",
      { rawSignedTx: awaitingRawSignedTx },
      { removeOnComplete: true }
    );

    await job.progress(100);

    done(null, `awaitTransactionJob for ${txhash} done`);
  } catch (err) {
    done(err);
  }
}

transactionQueue.process("sendTransactionJob", 400, sendTransactionJob);
transactionQueue.process("checkTransactionJob", 400, checkTransactionJob);
transactionQueue.process("awaitTransactionJob", 400, awaitTransactionJob);
