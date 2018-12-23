'use strict'
let ravencoin = require('ravencoinjs-lib');

let decodeFormat = function(tx) {
  let result = {
    txid: tx.getId(),
    version: tx.version,
    locktime: tx.locktime,
    size: tx.byteLength(),
    vsize: tx.virtualSize(),
  };
  return result;
}

let decodeInput = function(tx) {
  let result = tx.ins.map(function(input, n) {
    let vin = {
      txid: input.hash.reverse().toString('hex'),
      n: input.index,
      script: ravencoin.script.toASM(input.script),
      sequence: input.sequence,
    }
    return vin
  })
  return result
}

let decodeOutput = function(tx, network) {

  let format = function(out, n, network) {
    let vout = {
      satoshi: out.value,
      value: (1e-8 * out.value).toFixed(8),
      n: n,
      scriptPubKey: {
        asm: ravencoin.script.toASM(out.script),
        hex: out.script.toString('hex'),
        type: ravencoin.script.classifyOutput(out.script),
        addresses: [],
      },
    };
    switch (vout.scriptPubKey.type) {
      case 'pubkeyhash':
      case 'scripthash':
        vout.scriptPubKey.addresses.push(ravencoin.address.fromOutputScript(out.script, network));
        break;
      case 'pubkey': // There really is no address
        let pubKeyBuffer = ravencoin.script.pubKey.output.decode(out.script);
        vout.scriptPubKey.addresses.push(ravencoin.ECPair.fromPublicKeyBuffer(pubKeyBuffer, network).getAddress());
        break;
      case 'nulldata': // OP_RETURN
        break;
      default:
        break;
    }
    return vout
  }

  let result = tx.outs.map(function(out, n) {
    return format(out, n, network);
  })
  return result
}

module.exports = class RavencoinZMQDecoder {
  constructor(network = 'mainnet') {
    if(network === 'mainnet') {
      this.network = { 'pubKeyHash': 0x3c, 'scriptHash': 0x7a };
    } else {
      this.network = { 'pubKeyHash': 0x6F, 'scriptHash': 0xc4 };
    }
  }

  decodeTransaction(hex) {
    let tx = ravencoin.Transaction.fromHex(hex);
    let format = decodeFormat(tx);
    let inputs = decodeInput(tx);
    let outputs = decodeOutput(tx, this.network);
    return {
      format: format,
      inputs: inputs,
      outputs: outputs,
    }
  }

  decodeBlock(hex) {
    let block = ravencoin.Block.fromHex(hex);
    let totalOuts = 0;
    block.transactions.forEach((tx, indx) => {

      tx.outs.forEach((output) => {
        totalOuts += output.value;
      });
    });

    return {
      "transactions": block.transactions.length,
      "totalRVNSent": totalOuts,
      "reward": 500000000000,
      "prevHash": block.prevHash.toString('hex'),
      "id": block.getHash().toString('hex'),
      "hash": block.getHash().toString('hex').match(/.{2}/g).reverse().join(""),
      "merkleRoot": block.merkleRoot.toString('hex'),
      "version": block.version,
      "time": block.timestamp,
      "bits": block.bits,
      "nonce": block.nonce
    };
  }
}
