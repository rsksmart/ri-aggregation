import { Wallet as RollupWallet, RootstockOperation, utils } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { ContractReceipt, Wallet as EthersWallet, constants } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    executeDeposit,
    executeDeposits,
    generateDeposits,
    prepareDeposit,
    resolveDeposit
} from '../../src/operations/deposit';
import config from '../../src/utils/config.utils';

use(sinonChai);

describe('prepareDeposit', () => {
    it('should return a deposit parameters with amount between min and max', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const { address } = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, address);
        const [minAmount, maxAmount] = config.weiLimits.deposit;

        expect(deposit.amount.gte(minAmount)).to.be.true;
        expect(deposit.amount.lt(maxAmount)).to.be.true;
    });
    it('should return a deposit with token address set to zero', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const { address } = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, address);

        expect(deposit.token).to.eq(constants.AddressZero);
    });
    it('should return a deposit with depositTo set to l1recipient address', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const { address: expectedAddress } = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, expectedAddress);

        expect(deposit.depositTo).to.eq(expectedAddress);
    });
});

describe('executeDeposit', () => {
    it('should execute deposit', async () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        l2sender.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        const { address } = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, address);
        const expectedParameters = { ...deposit };
        delete expectedParameters.from;
        await executeDeposit(deposit);

        expect(l2sender.depositToSyncFromRootstock).to.have.been.calledOnceWith(expectedParameters);
    });

    it('should return deposit operation', async () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        l2sender.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        const { address } = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, address);
        const depositOperation = await executeDeposit(deposit);

        expect(depositOperation).to.be.instanceOf(RootstockOperation);
    });
});

describe('getDepositResult', () => {
    it('should return deposit result', async () => {
        const depositOp = sinon.createStubInstance(RootstockOperation);
        const expectedL1Receipt = { confirmations: 1 } as ContractReceipt;
        depositOp.awaitRootstockTxCommit.callsFake(() => Promise.resolve(expectedL1Receipt));
        const depositResult = await resolveDeposit(depositOp);

        expect(depositResult.opL1Receipt).to.eq(expectedL1Receipt);
    });
});

describe('executeDeposits', () => {
    it('should execute all transfers', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const recipients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateDeposits(numberOfDeposits, funderL2Wallet, recipients);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(transfers, delay);

        expect(executedDeposits.length).to.eq(numberOfDeposits);
    });

    it('should return executed transfers', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const recipients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateDeposits(numberOfDeposits, funderL2Wallet, recipients);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(transfers, delay);

        for (const executedDeposit of executedDeposits) {
            expect(await executedDeposit).to.be.instanceOf(RootstockOperation);
        }
    });

    it('should delay between transfers', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const recipients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateDeposits(numberOfDeposits, funderL2Wallet, recipients);
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeDeposits(transfers, delay);

        expect(sleepStub).to.have.callCount(numberOfDeposits - 1);
    });

    it('should executed correct number of transfers per seconf', async function () {
        const expectedTPS = 3;
        const totalSimTime = 3;
        const numberOfDeposits = expectedTPS * totalSimTime;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const depositToSyncFromRootstockSpy = funderL2Wallet.depositToSyncFromRootstock;
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const recipients = [...Array(5)].map(() => sinon.createStubInstance(EthersWallet));
        const transfers = generateDeposits(numberOfDeposits, funderL2Wallet, recipients);
        const delay = 1000 / expectedTPS;
        this.timeout(totalSimTime * 1000);
        await executeDeposits(transfers, delay);

        expect(depositToSyncFromRootstockSpy.callCount / totalSimTime).to.eq(expectedTPS);
    });
});
