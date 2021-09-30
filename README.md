# domimi

smart contract chastity system

1. Run `npm install` in `./server`
1. Run `docker-compose up`
1. Open Remix http://localhost:8080
   1. Open "Deploy & run transactions"
   1. Select "Web3 Provider" in "Environment"
   1. Set `http://localhost:8545`
   1. Deploy domimi.sol
1. Run `curl -X POST -H 'Content-type: application/json' -d '{"address": "0xFILL_WITH_YOUR_CONTRACT_ADDRESS"}' http://localhost:3000/api/unlock`
