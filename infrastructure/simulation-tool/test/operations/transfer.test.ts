import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { expect, use } from 'chai';
import { Wallet as EthersWallet, constants } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import config from '../../src/utils/config.utils';
import {
    executeTransfer,
    geteTransferResult,
    prepareTransfer,
    generateTransfers,
    executeTransfers
} from '../../src/operations/transfer';
import { utils } from '@rsksmart/rif-rollup-js-sdk/';

use(sinonChai);

afterEach(() => {
    sinon.restore();
});

describe('prepareTransfer', () => {
    it('should return transfer parameters with amount between min and max', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = sinon.createStubInstance(EthersWallet);
        const transfer = prepareTransfer(sender, recipient);
        const [minAmount, maxAmount] = config.weiLimits.transferToNew;

        expect(transfer.amount.gte(minAmount)).to.be.true;
        expect(transfer.amount.lt(maxAmount)).to.be.true;
    });

    it('should return a transfer with token address set to zero', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = sinon.createStubInstance(EthersWallet);
        const transfer = prepareTransfer(sender, recipient);

        expect(transfer.token).to.eq(constants.AddressZero);
    });

    it('should return a transfer with nonce set to committed', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = sinon.createStubInstance(EthersWallet);
        const transfer = prepareTransfer(sender, recipient);

        expect(transfer.nonce).to.eq('committed');
    });
});

describe('executeTransfer', () => {
    it('should execute transfer', async () => {
        const sender = sinon.createStubInstance(RollupWallet);
        sender.syncTransfer.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const recipient = sinon.createStubInstance(EthersWallet);
        const transfer = prepareTransfer(sender, recipient);
        const expectedParameters = { ...transfer };
        delete expectedParameters.from;
        await executeTransfer(transfer);

        expect(sender.syncTransfer).to.have.been.calledOnceWith(expectedParameters);
    });

    it('should return transfer operation', async () => {
        const sender = sinon.createStubInstance(RollupWallet);
        sender.syncTransfer.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const recipient = sinon.createStubInstance(EthersWallet);
        const transfer = prepareTransfer(sender, recipient);
        const transferOperation = await executeTransfer(transfer);

        expect(transferOperation).to.be.instanceOf(Transaction);
    });
});

describe('geteTransferResult', () => {
    it('should return transfer result', async () => {
        const transfer = sinon.createStubInstance(Transaction);
        const expectedL2Receipt = { executed: true } as TransactionReceipt;
        transfer.awaitReceipt.callsFake(() => Promise.resolve(expectedL2Receipt));
        const expectedVerifierReceipt = { executed: true } as TransactionReceipt;
        transfer.awaitVerifyReceipt.callsFake(() => Promise.resolve(expectedVerifierReceipt));

        const transferResult = await geteTransferResult(transfer);

        expect(transferResult.opL2Receipt).to.eq(expectedL2Receipt);
        expect(transferResult.verifierReceipt).to.eq(expectedVerifierReceipt);
    });
});

describe('generateTransfers', () => {
    it('should generate expected number of transfers', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const recepients = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);

        expect(transfers.length).to.eq(numberOfTransfers);
    });

    it('should generate transfers with funder as sender', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const recepients = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);

        transfers.forEach((transfer) => {
            expect(transfer.from).to.eq(funderL2Wallet);
        });
    });

    it('should generate transfers with recepients as recipients', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const recepients = [...Array(numberOfTransfers)].map(() => {
            const walletStub = sinon.createStubInstance(EthersWallet);
            (<{ address: string }>walletStub).address = '0x' + Math.random().toString(16).substring(2, 42);

            return walletStub;
        });
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);
        const expectedRecepients = recepients.map((receipient) => receipient.address);

        transfers.forEach((transfer) => {
            expect(expectedRecepients).to.include(transfer.to);
        });
    });
});

describe('executeTransfers', () => {
    it('should execute all transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const recepients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedTransfers = await executeTransfers(transfers, funderL2Wallet, delay);

        expect(executedTransfers.length).to.eq(numberOfTransfers);
    });

    it('should return executed transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const recepients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedTransfers = await executeTransfers(transfers, funderL2Wallet, delay);

        for (const executedTransfer of executedTransfers) {
            expect(await executedTransfer).to.be.instanceOf(Transaction);
        }
    });

    it('should delay between transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const recepients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateTransfers(numberOfTransfers, funderL2Wallet, recepients);
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeTransfers(transfers, funderL2Wallet, delay);

        expect(sleepStub).to.have.callCount(numberOfTransfers - 1);
    });

    // Couldn't test the time to execute the transfers
});
