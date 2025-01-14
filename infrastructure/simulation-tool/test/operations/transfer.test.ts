import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { utils } from '@rsksmart/rif-rollup-js-sdk/';
import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    executeTransfer,
    executeTransfers,
    generateTransfersToExisting,
    generateTransfersToNew,
    prepareTransfer
} from '../../src/operations/transfer';
import config from '../../src/utils/config.utils';
import { constants, ethers } from 'ethers';

use(sinonChai);

afterEach(() => {
    sinon.restore();
});

describe('prepareTransfer', () => {
    it('should return transfer parameters with amount between min and max', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = constants.AddressZero;
        const transfer = prepareTransfer(sender, recipient);
        const [minAmount, maxAmount] = config.weiLimits.transfer;

        expect(transfer.amount.gte(minAmount)).to.be.true;
        expect(transfer.amount.lt(maxAmount)).to.be.true;
    });

    it('should return a transfer with token address set to zero', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = constants.AddressZero;
        const transfer = prepareTransfer(sender, recipient);

        expect(transfer.token).to.eq('RBTC');
    });

    it('should return a transfer with nonce set to committed', () => {
        const sender = sinon.createStubInstance(RollupWallet);
        const recipient = constants.AddressZero;
        const transfer = prepareTransfer(sender, recipient);

        expect(transfer.nonce).to.eq('committed');
    });
});

describe('generateTransfersToNew', () => {
    it('should generate expected number of transfers', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const users = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);

        expect(transfers.length).to.eq(numberOfTransfers);
    });

    it('should generate transfers with funder as sender', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const users = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);

        transfers.forEach((transfer) => {
            expect(transfer.from.address()).to.eq(funderL2Wallet.address());
        });
    });

    it('should generate transfers with for users', () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const users = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);
        const expectedRecipients = users.map((receipient) => receipient.address());

        transfers.forEach((transfer) => {
            expect(expectedRecipients).to.include(transfer.to);
        });
    });
});

describe('generateTransfersToExisting', () => {
    it('should generate expected number of transfers', () => {
        const numberOfTransfers = 10;
        const users = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToExisting(numberOfTransfers, users);

        expect(transfers.length).to.eq(numberOfTransfers);
    });

    it('should generate transfers with sender from given senders', () => {
        const numberOfTransfers = 10;
        const users = [...Array(numberOfTransfers)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, users);

        transfers.forEach((transfer) => {
            expect(users).to.include(transfer.from);
        });
    });

    it('should generate transfers with recipient from given users', () => {
        const numberOfTransfers = 10;
        const users = [...Array(numberOfTransfers)].map(() => {
            const walletStub = sinon.createStubInstance(RollupWallet);
            walletStub.address.callsFake(() => ethers.Wallet.createRandom().address);

            return walletStub;
        });
        const transfers = generateTransfersToNew(numberOfTransfers, users);
        const expectedRecipients = users.map((receipient) => receipient.address());

        transfers.forEach((transfer) => {
            expect(expectedRecipients).to.include(transfer.to);
        });
    });
});

describe('executeTransfer', () => {
    it('should execute transfer', async () => {
        const sender = sinon.createStubInstance(RollupWallet);
        sender.syncTransfer.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const recipient = constants.AddressZero;
        const transfer = prepareTransfer(sender, recipient);
        const expectedParameters = { ...transfer };
        delete expectedParameters.from;
        await executeTransfer(transfer);

        expect(sender.syncTransfer).to.have.been.calledOnceWith(expectedParameters);
    });

    it('should return Rollup transaction', async () => {
        const sender = sinon.createStubInstance(RollupWallet);
        sender.syncTransfer.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const recipient = constants.AddressZero;
        const transfer = prepareTransfer(sender, recipient);
        const transferOperation = await executeTransfer(transfer);

        expect(transferOperation).to.be.instanceOf(Transaction);
    });
});

describe('executeTransfers', () => {
    it('should execute all transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const users = [...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedTransfers = await executeTransfers(transfers, delay);

        expect(executedTransfers.length).to.eq(numberOfTransfers);
    });

    it('should return executed transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const users = [...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedTransfers = await executeTransfers(transfers, delay);

        for (let i = 0; i < executedTransfers.length; i++) {
            expect(await executedTransfers[i], `tx: ${i}`).to.be.instanceOf(Transaction);
        }
    });

    it('should delay between transfers', async () => {
        const numberOfTransfers = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const users = [...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeTransfers(transfers, delay);

        expect(sleepStub).to.have.callCount(numberOfTransfers - 1);
    });

    it('should executed correct number of transfers per second', async function () {
        const expectedTPS = 3;
        const totalSimTime = 3;
        const numberOfTransfers = expectedTPS * totalSimTime;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const syncTransferSpy = funderL2Wallet.syncTransfer;
        funderL2Wallet.syncTransfer.resolves(sinon.createStubInstance(Transaction));
        const users = [...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const transfers = generateTransfersToNew(numberOfTransfers, [funderL2Wallet, ...users]);
        const delay = 1000 / expectedTPS;
        this.timeout(totalSimTime * 1000);
        await executeTransfers(transfers, delay);

        expect(syncTransferSpy.callCount / totalSimTime).to.eq(expectedTPS);
    });
});
