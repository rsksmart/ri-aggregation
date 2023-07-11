import { Wallet as RollupWallet, RootstockOperation, utils } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { BigNumber, ContractReceipt, Wallet as EthersWallet } from 'ethers';
import sinon, { SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import {
    PreparedDeposit,
    executeDeposit,
    executeDeposits,
    generateDeposits,
    prepareDeposit,
    resolveRootstockOperation
} from '../../src/operations/deposit';
import config from '../../src/utils/config.utils';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

use(sinonChai);

let l1senderStub: SinonStubbedInstance<EthersWallet>;
let l2senderStub: SinonStubbedInstance<RollupWallet>;
beforeEach(() => {
    l1senderStub = sinon.createStubInstance(EthersWallet, {
        getTransactionCount: Promise.resolve(0)
    });
    l2senderStub = sinon.createStubInstance(RollupWallet, {
        depositToSyncFromRootstock: Promise.resolve(sinon.createStubInstance(RootstockOperation)),
        ethSigner: l1senderStub
    });
});

afterEach(() => {
    sinon.reset();
    sinon.restore();
});

describe('prepareDeposit', () => {
    it('should return a deposit parameters with amount between min and max', () => {
        const deposit = prepareDeposit(l2senderStub, l1senderStub.address);
        const [minAmount, maxAmount] = config.weiLimits.deposit;

        expect(deposit.amount.gte(minAmount)).to.be.true;
        expect(deposit.amount.lt(maxAmount)).to.be.true;
    });
    it('should return a deposit with token address set to zero', () => {
        const deposit = prepareDeposit(l2senderStub, l1senderStub.address);

        expect(deposit.token).to.eq('RBTC');
    });
    it('should return a deposit with depositTo set to l1recipient address', () => {
        const { address: expectedAddress } = l1senderStub;
        const deposit = prepareDeposit(l2senderStub, expectedAddress);

        expect(deposit.depositTo).to.eq(expectedAddress);
    });
});

describe('executeDeposit', () => {
    it('should execute deposit', async () => {
        const deposit = prepareDeposit(l2senderStub, l1senderStub.address);
        const expectedParameters = { ...deposit };
        delete expectedParameters.from;
        await executeDeposit(deposit);

        expect(l2senderStub.depositToSyncFromRootstock).to.have.been.calledOnceWith(expectedParameters);
    });

    it('should return RootstockOperation', async () => {
        const deposit = prepareDeposit(l2senderStub, l1senderStub.address);
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
        const expectedVerifierReceipt = { block: { blockNumber: 2 } } as PriorityOperationReceipt;
        depositOp.awaitVerifyReceipt.callsFake(() => Promise.resolve(expectedVerifierReceipt));
        const depositResult = await resolveRootstockOperation(depositOp);

        expect(depositResult.opL1Receipt).to.eq(expectedL1Receipt);
        expect(depositResult.opL2Receipt).to.eq(expectedL2Receipt);
        expect(depositResult.opL2Receipt).to.eq(expectedL2Receipt);
    });
});

describe('executeDeposits', () => {
    const delay = 0;
    const numberOfDeposits = 10;

    let preparedDeposit: PreparedDeposit[];
    let users: RollupWallet[];

    beforeEach(() => {
        l2senderStub._ethSigner = l1senderStub;
        users = [l2senderStub, ...Array(5)].map(() => l2senderStub);
        preparedDeposit = generateDeposits(numberOfDeposits, users);
    });

    it('should execute all deposits', async () => {
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(preparedDeposit, delay);

        expect(executedDeposits.length).to.eq(numberOfDeposits);
    });

    it('should return executed deposits', async () => {
        const delay = 0;
        sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedDeposits = await executeDeposits(preparedDeposit, delay);

        for (const executedDeposit of executedDeposits) {
            expect(await executedDeposit).to.be.instanceOf(RootstockOperation);
        }
    });

    it('should delay between deposits', async () => {
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeDeposits(preparedDeposit, delay);

        expect(sleepStub).to.have.callCount(numberOfDeposits - 1);
    });

    it.only('should executed correct number of deposits per second', async function () {
        const expectedTPS = 3;
        const totalSimTime = 3;
        const numberOfDeposits = expectedTPS * totalSimTime;

        console.log('🦆 ~ file: deposit.test.ts:133 ~ numberOfDeposits:', numberOfDeposits);
        const depositToSyncFromRootstockSpy = l2senderStub.depositToSyncFromRootstock;
        const deposits: PreparedDeposit[] = [...Array(numberOfDeposits)].map<PreparedDeposit>(() => ({
            amount: BigNumber.from(1),
            from: l2senderStub,
            depositTo: l1senderStub.address,
            token: 'RBTC'
        }));
        const delay = 1000 / expectedTPS;
        this.timeout(totalSimTime * 1000);
        await executeDeposits(deposits, delay);
        const actualTPS = depositToSyncFromRootstockSpy.callCount / totalSimTime;

        expect(actualTPS).to.eq(expectedTPS);
    });
});
