import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';

class InMemoryStorage {
    static accounts = new Array<RollupWallet>();
}

export default InMemoryStorage;
