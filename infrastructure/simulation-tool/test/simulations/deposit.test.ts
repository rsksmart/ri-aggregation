import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { BigNumber } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { depositToSelf } from '../../src/operations/deposit';

use(sinonChai);

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
