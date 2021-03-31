import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export const BIG_DECIMAL_1E6 = BigDecimal.fromString('1e6')

export const BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18')

export const BIG_DECIMAL_ZERO = BigDecimal.fromString('0')

export const BIG_DECIMAL_ONE = BigDecimal.fromString('1')

export const BIG_INT_ONE = BigInt.fromI32(1)

export const BIG_INT_ONE_DAY_SECONDS = BigInt.fromI32(86400)

export const BIG_INT_ZERO = BigInt.fromI32(0)

export const LOCKUP_POOL_NUMBER = BigInt.fromI32(29)

export const FACTORY_ADDRESS = Address.fromString('0x601F49Ea6e1d51674C75F6FC21Ce8a5c88d73d44')

export const LOCKUP_BLOCK_NUMBER = BigInt.fromI32(10959148)

export const MASTER_CHEF_ADDRESS = Address.fromString('0x525Efa1653445a2E4F43db63390680709CfF81b8')

export const SUSHI_BAR_ADDRESS = Address.fromString('0x910C902ddfF09e6e777c60711b497866cc36F599')

export const SUSHI_MAKER_ADDRESS = Address.fromString('0x9803E527348F78d998fF85995dDe0776d10c8DAd')

export const SUSHI_TOKEN_ADDRESS = Address.fromString('0xa621Ea89a9d9d9cb543344943Dc71E82C614d581')

export const SUSHI_USDT_PAIR_ADDRESS = Address.fromString('0xF40eDdD5652Ca16e2C97B93112a7498DCc47d81c')

export const XSUSHI_USDC_PAIR_ADDRESS = Address.fromString('0xd597924b16cc1904d808285bc9044fd51ceeead7')

export const XSUSHI_WETH_PAIR_ADDRESS = Address.fromString('0x36e2fcccc59e5747ff63a03ea2e5c0c2c14911e7')

export const NULL_CALL_RESULT_VALUE = '0x0000000000000000000000000000000000000000000000000000000000000001'

export const USDC_WETH_PAIR = '0x197ba3650edb7f29b4d726cfb0a09cf8b7e5e272'

export const DAI_WETH_PAIR = '0xb838e743415220fc0ab48698e6b2b08cdafc40b2'

export const USDT_WETH_PAIR = '0xF40eDdD5652Ca16e2C97B93112a7498DCc47d81c'

export const SUSHI_USDT_PAIR = '0x8C79B8b0004236ea22CF616210c38428e8a26d3d'

export const WHITELIST: string[] = [
  '0xbcced5560e50b1e6bb592ad067817b2d2ee3f808', // uSTAR
  '0x287596fb4c4c11e2c27c82d70fa7b2d0f09606e2', // uAXIE
  '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b', // USDC
  '0xc778417e063141139fce010982780140aa0cd5ab', // WETH
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
export const MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('0')

// minimum liquidity for price to get tracked
export const MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('0')

export const WETH_ADDRESS = Address.fromString('0xc778417E063141139Fce010982780140Aa0cD5Ab')

export const SUSHISWAP_WETH_USDT_PAIR_ADDRESS = Address.fromString('0x06da0fd433c1a5d7a4faa01111c044910a184553')

export const USDT_ADDRESS = Address.fromString('0xdac17f958d2ee523a2206206994597c13d831ec7')

export const MASTER_CHEF_START_BLOCK = BigInt.fromI32(8061950)

export const SUSHISWAP_WETH_USDT_PAIR_DEPLOY_BLOCK = BigInt.fromI32(99999999)

export const UNISWAP_FACTORY_ADDRESS = Address.fromString('0x601F49Ea6e1d51674C75F6FC21Ce8a5c88d73d44')

export const UNISWAP_SUSHI_ETH_PAIR_FIRST_LIQUDITY_BLOCK = BigInt.fromI32(8079687)

export const UNISWAP_WETH_USDT_PAIR_ADDRESS = Address.fromString('0xF40eDdD5652Ca16e2C97B93112a7498DCc47d81c')

export const UNISWAP_SUSHI_ETH_PAIR_ADDRESS = Address.fromString('0x2163534B9Df0528828b020A877dE5EE374EeC306')

export const UNISWAP_SUSHI_USDT_PAIR_ADDRESS = Address.fromString('0x8C79B8b0004236ea22CF616210c38428e8a26d3d')
