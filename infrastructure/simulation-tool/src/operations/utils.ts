import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { Wallet as EthersWallet } from 'ethers';

const chooseRandomWallet = (wallets: EthersWallet[]) => {
    const randIndex = Math.floor(Math.random() * wallets.length);
    return wallets.at(randIndex);
};

export { chooseRandomWallet };
