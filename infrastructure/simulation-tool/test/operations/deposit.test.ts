import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { expect, use } from 'chai';
import { ContractReceipt, Wallet as EthersWallet, constants } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import config from '../../src/utils/config.utils';
import { executeDeposit, getDepositResult, prepareDeposit } from '../../src/operations/deposit';

use(sinonChai);

describe('prepareDeposit', () => {
    it('should return a deposit parmenters with amount between min and max', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const l1recipient = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, l1recipient);
        const [minAmount, maxAmount] = config.weiLimits.deposit;

        expect(deposit.amount.gte(minAmount)).to.be.true;
        expect(deposit.amount.lt(maxAmount)).to.be.true;
    });
    it('should return a deposit with token address set to zero', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const l1recipient = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, l1recipient);

        expect(deposit.token).to.eq(constants.AddressZero);
    });
    it('should return a deposit with depositTo set to l1recipient address', () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        const l1recipient = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, l1recipient);

        expect(deposit.depositTo).to.eq(l1recipient.address);
    });
});

describe('executeDeposit', () => {
    it('should execute deposit', async () => {
        const l2sender = sinon.createStubInstance(RollupWallet);
        l2sender.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        const l1recipient = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, l1recipient);
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
        const l1recipient = sinon.createStubInstance(EthersWallet);
        const deposit = prepareDeposit(l2sender, l1recipient);
        const depositOperation = await executeDeposit(deposit);

        expect(depositOperation).to.be.instanceOf(RootstockOperation);
    });
});

describe('getDepositResult', () => {
    it('should return deposit result', async () => {
        const depositOp = sinon.createStubInstance(RootstockOperation);
        const expectedL1Receipt = { confirmations: 1 } as ContractReceipt;
        depositOp.awaitRootstockTxCommit.callsFake(() => Promise.resolve(expectedL1Receipt));
        const expectedL2Receipt = { executed: true } as PriorityOperationReceipt;
        depositOp.awaitReceipt.callsFake(() => Promise.resolve(expectedL2Receipt));
        const expectedVerifierReceipt = { executed: true } as PriorityOperationReceipt;
        depositOp.awaitVerifyReceipt.callsFake(() => Promise.resolve(expectedVerifierReceipt));
        const depositResult = await getDepositResult(depositOp);

        expect(depositResult.opL1Receipt).to.eq(expectedL1Receipt);
        expect(depositResult.opL2Receipt).to.eq(expectedL2Receipt);
        expect(depositResult.verifierReceipt).to.eq(expectedVerifierReceipt);
    });
});
