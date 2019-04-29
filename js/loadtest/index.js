const ethers = require('ethers')
const Franklin = require('../franklin/src/franklin')

const provider = new ethers.providers.JsonRpcProvider()
const franklin = new Franklin(process.env.API_SERVER, provider, process.env.CONTRACT_ADDR)
const sleep = async ms => await new Promise(resolve => setTimeout(resolve, ms))

let source = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, "m/44'/60'/0'/0/0").connect(provider)
let sourceNonce = null

const MIN_AMOUNT = ethers.utils.parseEther('0.1') // ~USD 15

var args = process.argv.slice(2)
let nClients = args[0] || 10
let tps = args[1] || 1000

console.log(`Usage: yarn test -- [nClients] [TPS]`)
console.log(`Starting loadtest for ${nClients} with ${tps} TPS`)

class Client {

    constructor(id) {
        this.id = id
        console.log(`creating client #${this.id}`)
    }

    async prepare() {
        let signer = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, "m/44'/60'/0'/0/" + this.id + 18)
        this.fra = await franklin.Wallet.fromSigner(signer)
        this.eth = this.fra.ethWallet

        try {
            await this.fra.pullState()
            if (this.fra.sidechainOpen) {
                console.log(`${this.eth.address}: sidechain account ${this.fra.sidechainAccountId}`)            
            } else {
                console.log(`${this.eth.address}: sidechain account not open, deposit required`)

                let balance = await this.eth.getBalance()
                console.log(`${this.eth.address}: current balance is ${ethers.utils.formatEther(balance)} ETH`)
                if (balance.lt(MIN_AMOUNT)) {
                    console.log(`${this.eth.address}: funding required`)
                    // transfer funds from source account
                    let request = await source.sendTransaction({
                        to:     this.eth.address,
                        value:  MIN_AMOUNT,
                        nonce:  sourceNonce++,
                    })
                    console.log(`${this.eth.address}: funding tx sent`)
                    let receipt = await request.wait()
                    console.log(`${this.eth.address}: funding tx mined`)
                }
                // deposit funds into franklin
                let request = await this.fra.deposit(MIN_AMOUNT)
                console.log(`${this.eth.address}: deposit tx sent`)
                let receipt = await request.wait()
                console.log(`${this.eth.address}: deposit tx mined, waiting for zk proof`)
                while (!this.fra.sidechainOpen) {
                    await sleep(500)
                    await this.fra.pullState()
                }
            }
        } catch (err) {
            console.log(`${this.eth.address}: ERROR: ${err}`)
        }
    }

    async send() {
        let account = await franklin.getAccount(this.id);
        console.log(`client #${this.id}: tx `, account)
        return 5
    }
}

let clients = []

async function test() {

    sourceNonce = await source.getTransactionCount("pending")
    console.log('sourceNonce', sourceNonce)
    //return 

    console.log('creating clients...')
    for (let i=0; i < nClients; i++) {
        clients.push(new Client(i))
    }

    console.log('preparing clients...')
    let promises = []
    for (let i=0; i < nClients; i++) {
        promises.push( clients[i].prepare() )
    }

    console.log('waiting until the clients are ready...')
    await Promise.all(promises)

    // console.log('starting the test...')
    // while(true) {
    //     var nextTick = new Date(new Date().getTime() + 1000);
    //     for (let i=0; i<tps; i++) {
    //         let client = Math.floor(Math.random() * nClients);
    //         clients[client].send()
    //     }
    //     console.log('-')
    //     while(nextTick > new Date()) {
    //         await new Promise(resolve => setTimeout(resolve, 1))
    //     }
    // }
}

test()