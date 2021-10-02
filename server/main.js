const Web3 = require('web3');
const express = require('express');
const bodyParser = require('body-parser');

const web3 = new Web3(new Web3.providers.HttpProvider('http://ganache:8545'));
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const abi = [
  {
    'type': 'function',
    'name': 'isUnderManagement',
    'inputs': [],
    'outputs': [{'name': '', 'type': 'bool'}],
    'constant': true,
    'payable': false
  }
];

var router = express.Router();

// test with:
// curl -X POST -H 'Content-type: application/json' -d '{"address": "0xXXX"}' http://localhost:3000/api/unlock
router.post('/unlock', async function(req, res) {
  try {
    const contract = new web3.eth.Contract(abi, req.body.address);
    if (!await contract.methods.isUnderManagement().call()) {
      res.send('your padlock number is 1234');
      return;
    }
    res.send('not allowed');
  } catch (e) {
    console.error(e);
    res.send('error');
  }
});
app.use('/api', router);
app.listen(3000);
