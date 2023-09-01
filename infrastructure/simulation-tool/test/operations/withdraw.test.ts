import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { Wallet as EthersWallet } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    executeWithdrawal,
    executeWithdrawals,
    generateWithdrawals,
    prepareWithdrawal,
    resolveWithdrawTransaction
} from '../../src/operations/withdraw';
import config from '../../src/utils/config.utils';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

use(sinonChai);

describe('prepareWithdraw', () => {
    it('should return a withdraw parameters with amount between min and max', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const withdrawal = prepareWithdrawal(l2sender);
        const [minAmount, maxAmount] = config.weiLimits.deposit;

        expect(withdrawal.amount.gte(minAmount), 'greater than min').to.be.true;
        expect(withdrawal.amount.lt(maxAmount), 'less than max').to.be.true;
    });

    it('should return a withdraw with token set to "RBTC"', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const withdrawal = prepareWithdrawal(l2sender);

        expect(withdrawal.token).to.eq('RBTC');
    });

    it('should return a withdrawal with ethAddress set to the L1 address', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const { address: expectedAddress } = sinon.createStubInstance(EthersWallet);
        const withdrawal = prepareWithdrawal(l2sender);

        expect(withdrawal.ethAddress).to.eq(expectedAddress);
    });
});

describe('executeWithdraw', () => {
    it('should execute withdrawal', async () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        l2sender.withdrawFromSyncToRootstock.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const withdrawal = prepareWithdrawal(l2sender);
        const expectedParameters = { ...withdrawal };
        delete expectedParameters.from;
        await executeWithdrawal(withdrawal);

        expect(l2sender.withdrawFromSyncToRootstock).to.have.been.calledOnceWith(expectedParameters);
    });

    it('should return Transaction', async () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        l2sender.withdrawFromSyncToRootstock.callsFake(() => Promise.resolve(sinon.createStubInstance(Transaction)));
        const withdrawal = prepareWithdrawal(l2sender);
        const depositOperation = await executeWithdrawal(withdrawal);

        expect(depositOperation).to.be.instanceOf(Transaction);
    });
});

describe('resolveTransaction', () => {
    it('should return withdrawal result', async () => {
        const withdrawOp = sinon.createStubInstance(Transaction);
        const expectedL2Receipt = {
            block: {
                blockNumber: 1,
                committed: true,
                verified: false
            },
            success: true
        } as TransactionReceipt;
        withdrawOp.awaitReceipt.callsFake(() => Promise.resolve(expectedL2Receipt));

        const expectedL2VerifyReceipt = {
            block: {
                blockNumber: 1,
                committed: true,
                verified: true
            },
            success: true
        } as TransactionReceipt;
        withdrawOp.awaitVerifyReceipt.callsFake(() => Promise.resolve(expectedL2VerifyReceipt));
        const depositResult = await resolveWithdrawTransaction(withdrawOp);

        expect(depositResult.opL2Receipt).to.eq(expectedL2Receipt);
    });
});

describe('executeWithdrawals', () => {
    it('should execute all withdrawals', async () => {
        const numberOfWithdrawals = 10;
        const users = [...Array(5)].map(() => {
            const l2Wallet = sinon.createStubInstance(RollupWallet);
            l2Wallet.withdrawFromSyncToRootstock.resolves(sinon.createStubInstance(Transaction));
            return l2Wallet;
        });
        const withdrawals = generateWithdrawals(numberOfWithdrawals, users);
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const delay = 0;
        const executedWithdrawals = await executeWithdrawals(withdrawals, delay);

        expect(executedWithdrawals.length).to.eq(numberOfWithdrawals);
        sleepStub.restore();
    });

    it('should return executed withdrawals', async () => {
        const numberOfWithdrawals = 10;
        const users = [...Array(5)].map(() => {
            const l2Wallet = sinon.createStubInstance(RollupWallet);
            l2Wallet.withdrawFromSyncToRootstock.resolves(sinon.createStubInstance(Transaction));
            return l2Wallet;
        });
        const withdrawals = generateWithdrawals(numberOfWithdrawals, users);
        const delay = 0;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        const executedWithdrawals = await executeWithdrawals(withdrawals, delay);

        for (const executedWithdrawal of executedWithdrawals) {
            expect(await executedWithdrawal).to.be.instanceOf(Transaction);
        }
        sleepStub.restore();
    });

    it('should delay between withdrawals', async () => {
        const numberOfWithdrawals = 10;
        const users = [...Array(5)].map(() => {
            const l2Wallet = sinon.createStubInstance(RollupWallet);
            l2Wallet.withdrawFromSyncToRootstock.resolves(sinon.createStubInstance(Transaction));
            return l2Wallet;
        });
        const withdrawals = generateWithdrawals(numberOfWithdrawals, users);
        const delay = 100;
        const sleepStub = sinon.stub(utils, 'sleep').callsFake(() => Promise.resolve());
        await executeWithdrawals(withdrawals, delay);

        expect(sleepStub).to.have.callCount(numberOfWithdrawals - 1);

        sleepStub.restore();
    });

    it('should executed correct number of withdrawals per second', async function () {
        const expectedTPS = 3;
        const totalSimTime = 3;
        const numberOfDeposits = expectedTPS * totalSimTime;
        const users = [...Array(5)].map(() => {
            const l2Wallet = sinon.createStubInstance(RollupWallet);
            l2Wallet.withdrawFromSyncToRootstock.resolves(sinon.createStubInstance(Transaction));
            return l2Wallet;
        });
        const withdrawals = generateWithdrawals(numberOfDeposits, users);
        const delay = 1000 / expectedTPS;
        this.timeout(totalSimTime * 1000);
        await executeWithdrawals(withdrawals, delay);

        const totalCallCount = users.reduce((acc, user) => {
            return acc + user.withdrawFromSyncToRootstock.callCount;
        }, 0);

        expect(totalCallCount / totalSimTime).to.eq(expectedTPS);
    });
});
