const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const abi = [{
    'type': 'function', 'name': 'start',
    'inputs': [
      {'name': '_master', 'type': 'address'},
      {'name': '_period', 'type': 'uint256'},
      {'name': '_initialCost', 'type': 'uint256'},
      {'name': '_abortCost', 'type': 'uint256'},
      {'name': '_execCost', 'type': 'uint256'},
      {'name': '_maxExtent', 'type': 'uint256'},
      {'name': 'minBalance', 'type': 'uint256'},
      {'name': 'nonce', 'type': 'uint256'},
      {'name': 'signature', 'type': 'bytes'}
    ],
    'outputs': [],
    'constant': false, 'payable': true
  }, {
    'type': 'function', 'name': 'extendPeriod',
    'inputs': [{'name': '_extent', 'type': 'uint256'}],
    'outputs': [],
    'constant': false, 'payable': false
  }, {
    'type': 'function', 'name': 'exit',
    'inputs': [],
    'outputs': [],
    'constant': false, 'payable': false
  }, {
    'type': 'function', 'name': 'abort',
    'inputs': [],
    'outputs': [],
    'constant': false, 'payable': true
  }, {
    'type': 'function', 'name': 'refund',
    'inputs': [],
    'outputs': [],
    'constant': false, 'payable': false
  }, {
    'type': 'function', 'name': 'withdraw',
    'inputs': [
      {'name': 'receiver', 'type': 'address'},
    ],
    'outputs': [],
    'constant': false, 'payable': false
  }, {
    'type': 'function', 'name': 'isUnderManagement',
    'inputs': [],
    'outputs': [{'name': '', 'type': 'bool'}],
    'constant': true, 'payable': false
  }, {
    'type': 'function', 'name': 'getExpiration',
    'inputs': [],
    'outputs': [{'name': '', 'type': 'uint256'}],
    'constant': true, 'payable': false
  }, {
    'type': 'function', 'name': 'getOwner',
    'inputs': [],
    'outputs': [{'name': '', 'type': 'address'}],
    'constant': true, 'payable': false
  }, {
    'type': 'function', 'name': 'getMaster',
    'inputs': [],
    'outputs': [{'name': '', 'type': 'address'}],
    'constant': true, 'payable': false
  }
];

function write(title, msg) {
  const line = document.createElement('div');
  line.innerHTML = title + '> ' + msg;
  document.getElementById('console').appendChild(line);
}
function writeLog(title, msg) {
  write(title + '(ok)', msg);
}
function writeError(title, msg) {
  write(title + '(error)', msg);
}

function generateSignature(
  contract, master, period, initialCost, abortCost, execCost, maxExtent, minBalance, nonce
) {
  const encoded = Web3.utils.soliditySha3(
    {t: 'uint256', v: period},
    {t: 'uint256', v: initialCost},
    {t: 'uint256', v: abortCost},
    {t: 'uint256', v: execCost},
    {t: 'uint256', v: maxExtent},
    {t: 'uint256', v: minBalance},
    {t: 'uint256', v: nonce},
    {t: 'address', v: contract.options.address}
  );
  const sign = web3.eth.accounts.sign(encoded, document.getElementById('privkey').value);
  return JSON.stringify({
    master, period, initialCost, abortCost, execCost, maxExtent, minBalance, nonce,
    signature: sign.signature
  });
}

function start(
  contract, from, gas, _master, _period, _initialCost, _abortCost, _execCost,
  _maxExtent, minBalance, nonce, signature
) {
  contract.methods.start(
    _master, _period, _initialCost, _abortCost, _execCost,
    _maxExtent, minBalance, nonce, signature
  ).send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('start', response.transactionHash);
  }).catch(function(e) {
    writeError('start', e);
  });
}
function extendPeriod(contract, from, gas, extent) {
  contract.methods.extendPeriod(extent).send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('extendPeriod', response.transactionHash);
  }).catch(function(e) {
    writeError('extendPeriod', e);
  });
}
function exit(contract, from, gas) {
  contract.methods.exit().send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('exit', response.transactionHash);
  }).catch(function(e) {
    writeError('exit', e);
  });
}
function abort(contract, from, gas) {
  contract.methods.abort().send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('abort', response.transactionHash);
  }).catch(function(e) {
    writeError('abort', e);
  });
}
function refund(contract, from, gas) {
  contract.methods.refund().send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('refund', response.transactionHash);
  }).catch(function(e) {
    writeError('refund', e);
  });
}
function withdraw(contract, from, gas, reciever) {
  contract.methods.withdraw(reciever).send({ from, gas }).then(function(response) {
    console.log(response);
    writeLog('withdraw', response.transactionHash);
  }).catch(function(e) {
    writeError('withdraw', e);
  });
}

function checkBalance(address) {
  getBalance(address).then(function(balance) {
    writeLog('checkBalance', 'you have ' + balance + ' wei');
  }).catch(function(e) {
    writeError('checkBalance', e);
  });
}
function checkDeposit() {
  getBalance(contract.options.address).then(function(balance) {
    writeLog('checkDeposit', 'deposit on contract: ' + balance + ' wei');
  }).catch(function(e) {
    writeError('checkDeposit', e);
  });
}
function checkLocked(contract) {
  isUnlocked(contract).then(function(unlocked) {
    getExpiration(contract).then(function(expiration) {
      getUnlockKey(contract).then(function(text) {
        getMaster(contract).then(function(master) {
          getOwner(contract).then(function(owner) {
            const msg = (unlocked ? 'unlocked' :
              ('locked by ' + master + ' until ' + new Date(expiration * 1000).toISOString()))
              + ' (server said: ' + text + ')';
            writeLog('checkLocked', owner + ' is ' + msg);
          });
        });
      });
    });
  }).catch(function(e) {
    writeError('checkLocked', e);
  });
}

function send(from, to, amount) {
  web3.eth.sendTransaction({
    from, to, value: amount
  }).then(function(response) {
    console.log(response);
    writeLog('send', response.transactionHash);
  }).catch(function(e) {
    writeError('send', e);
  });
}

function isUnlocked(contract) {
  return contract.methods.isUnderManagement().call().then(function(isUnderManagement) {
    return !isUnderManagement;
  });
}
function getExpiration(contract) {
  return contract.methods.getExpiration().call().then(function(expiration) {
    return expiration;
  });
}
function getOwner(contract) {
  return contract.methods.getOwner().call().then(function(owner) {
    return owner;
  });
}
function getMaster(contract) {
  return contract.methods.getMaster().call().then(function(master) {
    return master;
  });
}
function getBalance(address) {
  return web3.eth.getBalance(address, function(e, balance) {
    if (e) {
      throw e;
    }
    return balance;
  });
}

function getUnlockKey(contract) {
  return fetch('http://localhost:3000/api/unlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({address: contract.options.address})
  }).then(function(response) {
    return response.text();
  });
}
