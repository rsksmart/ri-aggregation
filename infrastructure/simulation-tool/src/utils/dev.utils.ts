import { providers, Signer } from 'ethers';

const prepareDevL1Account = async (account: Signer): Promise<providers.TransactionReceipt> => {
    console.log('Finding first account with some balance ...');
    const provider = account.provider as providers.JsonRpcProvider;
    const devAccounts = await provider.listAccounts();
    const loadedSigner = devAccounts
        .map((accountAddress: string) => provider.getSigner(accountAddress))
        .find(async (signer: Signer) => {
            let balance = await signer.getBalance();

            return !balance.isZero();
        });

    if (!loadedSigner) {
        throw Error(
            'The provider does not contain a list of wealthy dev accounts. Cannot continue, please check your hardhat configuration.'
        );
    }

    const latestBlock = await provider.getBlock('latest');
    const gasLimit = latestBlock.gasLimit;
    console.log(`Found ${loadedSigner._address}. Syphoning ...`);

    const txRequest = await loadedSigner.populateTransaction({
        to: await account.getAddress(),
        value: (await loadedSigner.getBalance()).sub(gasLimit)
    });
    const txResponse = await loadedSigner.sendTransaction(txRequest);
    const receipt = await txResponse.wait();
    console.log(`Account loaded with: ${await account.getBalance()} RBTC.`);

    return receipt;
};

export { prepareDevL1Account };
