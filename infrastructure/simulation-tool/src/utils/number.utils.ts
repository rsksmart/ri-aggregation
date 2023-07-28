import { BigNumber, BigNumberish } from 'ethers';

type RandomAmountGenerator = Generator<BigNumber, BigNumber>;

const getRandomBigNumber = (min: BigNumberish, max: BigNumberish): BigNumber => {
    const diff = BigNumber.from(max).sub(min);
    const randomDecimal = Math.random();
    const scaled = diff.mul(BigNumber.from((randomDecimal * 1e18).toFixed()));
    const randomNumber = scaled.div(BigNumber.from((1e18).toString()));

    return randomNumber.add(min);
};

function* createRandomAmountGenerator(minMaxTuple: [BigNumberish, BigNumberish]): RandomAmountGenerator {
    const [min, max] = minMaxTuple;

    while (true) {
        yield getRandomBigNumber(min, max);
    }
}

export type { RandomAmountGenerator };

export { getRandomBigNumber, createRandomAmountGenerator };
