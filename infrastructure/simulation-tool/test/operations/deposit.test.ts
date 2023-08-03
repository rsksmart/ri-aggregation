import { Wallet as RollupWallet, RootstockOperation, utils } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { BigNumber, ContractReceipt, Wallet as EthersWallet } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    depositToSelf,
    executeDeposit,
    executeDeposits,
    generateDeposits,
    prepareDeposit,
    resolveRootstockOperation
} from '../../src/operations/deposit';
import config from '../../src/utils/config.utils';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

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

        expect(deposit.token).to.eq('RBTC');
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

    it('should return RootstockOperation', async () => {
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

describe('resolveRootstockOperation', () => {
    it('should return deposit result', async () => {
        const depositOp = sinon.createStubInstance(RootstockOperation);
        const expectedL1Receipt = { confirmations: 1 } as ContractReceipt;
        depositOp.awaitRootstockTxCommit.callsFake(() => Promise.resolve(expectedL1Receipt));
        const expectedL2Receipt = { block: { blockNumber: 1 } } as PriorityOperationReceipt;
        depositOp.awaitReceipt.callsFake(() => Promise.resolve(expectedL2Receipt));
        const depositResult = await resolveRootstockOperation(depositOp);

        expect(depositResult.opL1Receipt).to.eq(expectedL1Receipt);
        expect(depositResult.opL2Receipt).to.eq(expectedL2Receipt);
    });
});

describe('executeDeposits', () => {
    it('should execute all deposits', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const users = [funderL2Wallet, ...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const deposits = generateDeposits(numberOfDeposits, users);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(deposits, delay);

        expect(executedDeposits.length).to.eq(numberOfDeposits);
    });

    it('should return executed deposits', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const users = [funderL2Wallet, ...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const deposits = generateDeposits(numberOfDeposits, users);
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(deposits, delay);

        for (const executedDeposit of executedDeposits) {
            expect(await executedDeposit).to.be.instanceOf(RootstockOperation);
        }
    });

    it('should delay between deposits', async () => {
        const numberOfDeposits = 10;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const users = [funderL2Wallet, ...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const deposits = generateDeposits(numberOfDeposits, users);
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeDeposits(deposits, delay);

        expect(sleepStub).to.have.callCount(numberOfDeposits - 1);
    });

    it('should executed correct number of deposits per second', async function () {
        const expectedTPS = 3;
        const totalSimTime = 3;
        const numberOfDeposits = expectedTPS * totalSimTime;
        const funderL2Wallet = sinon.createStubInstance(RollupWallet);
        const depositToSyncFromRootstockSpy = funderL2Wallet.depositToSyncFromRootstock;
        funderL2Wallet.depositToSyncFromRootstock.resolves(sinon.createStubInstance(RootstockOperation));
        const users = [funderL2Wallet, ...Array(5)].map(() => sinon.createStubInstance(RollupWallet));
        const deposits = generateDeposits(numberOfDeposits, users);
        const delay = 1000 / expectedTPS;
        this.timeout(totalSimTime * 1000);
        await executeDeposits(deposits, delay);

        expect(depositToSyncFromRootstockSpy.callCount / totalSimTime).to.eq(expectedTPS);
    });
});

describe('depositToSelf', () => {
    it('should execute deposit against own address', async () => {
        const l2wallet = sinon.createStubInstance(RollupWallet);
        l2wallet.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        await depositToSelf(l2wallet, BigNumber.from(50));

        expect(l2wallet.depositToSyncFromRootstock).to.have.been.calledOnce;
    });

    it('should execute deposit with amount', async () => {
        const l2wallet = sinon.createStubInstance(RollupWallet);
        l2wallet.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        const expectedAmount = BigNumber.from(50);
        await depositToSelf(l2wallet, expectedAmount);

        expect(l2wallet.depositToSyncFromRootstock).to.have.been.calledWithMatch({
            amount: expectedAmount
        });
    });
});
