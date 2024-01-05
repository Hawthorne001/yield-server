const axios = require('axios');
const sdk = require('@defillama/sdk');

const abi = require('./abis/abi.json');
const stableAbi = require('./abis/stable.abi.json');

const BASE_URL = 'https://api.interport.fi';
const STABLECOIN_URL = 'https://app.interport.fi/stablecoin-pools';

const CHAINS = {
  1: 'Ethereum',
  250: 'Fantom Opera',
};

const ITP_ADDRESS = '0x2b1D36f5B61AdDAf7DA7ebbd11B35FD8cfb0DE31';
const STABLE_ADDRESS = '0x29d44c17f4f83b3c77ae2eac4bc1468a496e3196';
const PROJECT_NAME = 'interport-finance';

const STABLECOIN_FARM_TYPE_LIST = {
  [SupportedChains.ETHEREUM]: {
    '0xEc8DDCb498b44C35EFaD7e5e43E0Caf6D16A66E8': 0,
    '0x5b45B414c6CD2a3341bE70Ba22BE786b0124003F': 1,
  },
  [SupportedChains.FANTOM]: {
    '0xb6AB8EeFAE1a2c22Ca6338E143cb7dE544800c6e': 0,
  },
};

const getAPY = async () => {
  const promises = Object.keys(STABLECOIN_FARM_TYPE_LIST).map((chainId) => {
    return Object.keys(STABLECOIN_FARM_TYPE_LIST[chainId]).map(
      (address) => {
        return this.getData({
          chainId: Number(chainId),
          address,
        });
      },
    );
  });

  return await Promise.all(promises.flat());
}

const getData = async ({ chainId, address }) => {
  const calls = [];

  const symbol = await sdk.api.abi.multiCall({
    target: address,
    abi: 'erc20:symbol',
  })

  calls.push(sdk.api.abi.call({
    target: address,
    abi: abi.balanceOf,
    params: [STABLE_ADDRESS],
  }))

  calls.push(sdk.api.abi.call({
    target: STABLE_ADDRESS,
    abi: stableAbi.rewardTokenPerSecond,
  }))

  calls.push(sdk.api.abi.call({
    target: STABLE_ADDRESS,
    abi: stableAbi.totalAllocationPoint,
  }))

  calls.push(sdk.api.abi.call({
    target: STABLE_ADDRESS,
    abi: stableAbi.poolInfo,
    params: [STABLECOIN_FARM_TYPE_LIST[chainId][address]],
  }))

  const [
    tvlResponse,
    itpPerSecondResponse,
    totalAllocationPointResponse,
    poolInfoResponse
  ] = await Promise.all(calls);

  const tvl = tvlResponse.output;

  const { data } = await axios.get(`${BASE_URL}/utils/get-interport-token-info`);
  const itpPrice = data.price;
  const itpPerSecond = itpPerSecondResponse.output / 1e18;
  const itpPerYear = itpPerSecond * 60 * 60 * 24 * 365;

  const totalAllocationPoint = Number(totalAllocationPointResponse.output);
  const [
    stakingToken,
    stakingTokenTotalAmount,
    accumulatedRewardTokenPerShare,
    lastRewardTime,
    allocationPoint
  ] = poolInfoResponse.output;

  const totalInUSD = Number(stakingTokenTotalAmount / 1e6);
  const totalUSDPerPeriod =
    ((itpPerYear * itpPrice) / totalAllocationPoint) *
    Number(allocationPoint);

  const apr = (totalUSDPerPeriod * 100) / totalInUSD;

  return {
    chain: chainId,
    project: PROJECT_NAME,
    pool: address,
    symbol: symbol.replace('i', ''),
    apyBase: Number(apr),
    tvlUsd: Number(tvl),
  };
}

module.exports = {
  apy: getAPY,
  url: STABLECOIN_URL
};