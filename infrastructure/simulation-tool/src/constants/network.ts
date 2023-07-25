const NETWORKS = ['testnet', 'mainnet', 'regtest'] as const;

const CHAIN_TO_NETWORK: { [key in number]: typeof NETWORKS[number] } = {
    30: 'mainnet',
    31: 'testnet',
    33: 'regtest'
};

const NETWORK_TO_DERIVATION_PATH: { [key in typeof NETWORKS[number]]: `m/44'/${number}'/0'/0/` } = {
    mainnet: "m/44'/137'/0'/0/",
    testnet: "m/44'/37310'/0'/0/",
    regtest: "m/44'/37310'/0'/0/"
};

export { CHAIN_TO_NETWORK, NETWORK_TO_DERIVATION_PATH };
