import { providers, Signer, Wallet as EthersWallet } from 'ethers';

const prepareDevL1Account = async (account: EthersWallet): Promise<providers.TransactionReceipt> => {
    console.log('Finding first account with some balance ...');
    const provider = account.provider as providers.JsonRpcProvider;
    const devAccounts = await provider.listAccounts();
    const loadedSigner = devAccounts
        .map((accountAddress: string) => provider.getSigner(accountAddress))
        .find(async (signer: Signer) => {
            let balance = await signer.getBalance();
            return !balance.isZero;
        });

    const latestBlock = await provider.getBlock('latest');
    const gasLimit = latestBlock.gasLimit;
    console.log(`Found ${loadedSigner._address}. Syphoning ...`);

    const txRequest = await loadedSigner.populateTransaction({
        to: account.address,
        value: (await loadedSigner.getBalance()).sub(gasLimit),
        gasLimit
    });
    const txResponse = await loadedSigner.sendTransaction(txRequest);
    const receipt = await txResponse.wait();
    console.log(`Account loaded with: ${await account.getBalance()} RBTC.`);

    return receipt;
};

export { prepareDevL1Account };
