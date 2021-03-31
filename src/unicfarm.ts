import {
  Add,
  Deposit,
  Dev,
  EmergencyWithdraw,
  MassUpdatePools,
  UnicFarm as UnicFarmContract,
  //MigrateCall,
  OwnershipTransferred,
  Set,
  //SetMigratorCall,
  UpdatePool,
  Withdraw,
} from '../generated/UnicFarm/UnicFarm'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import {
  BIG_DECIMAL_1E12,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ONE_DAY_SECONDS,
  BIG_INT_ZERO,
  LOCKUP_BLOCK_NUMBER,
  MASTER_CHEF_ADDRESS,
  MASTER_CHEF_START_BLOCK,
  SUSHI_TOKEN_ADDRESS,
} from './constants'
import { History, UnicFarm, Pool, PoolHistory, User } from '../generated/schema'
import { getUnicPrice, getUSDRate } from './price'

import { ERC20 as ERC20Contract } from '../generated/UnicFarm/ERC20'
import { Pair as PairContract } from '../generated/UnicFarm/Pair'

function getUnicFarm(block: ethereum.Block): UnicFarm {
  let unicFarm = UnicFarm.load(MASTER_CHEF_ADDRESS.toHex())

  if (unicFarm === null) {
    const contract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)
    unicFarm = new UnicFarm(MASTER_CHEF_ADDRESS.toHex())
    unicFarm.mintRateMultiplier = contract.mintRateMultiplier()
    unicFarm.mintRateDivider = contract.mintRateDivider()
    unicFarm.devaddr = contract.devaddr()
    // unicFarm.migrator = contract.migrator()
    unicFarm.owner = contract.owner()
    // poolInfo ...
    unicFarm.startBlock = contract.startBlock()
    unicFarm.unic = contract.unic()
    unicFarm.blocksPerTranche = contract.blocksPerTranche()
    unicFarm.unicPerBlock = contract.unicPerBlock()
    unicFarm.totalAllocPoint = contract.totalAllocPoint()
    // userInfo ...
    unicFarm.poolCount = BIG_INT_ZERO

    unicFarm.uptBalance = BIG_DECIMAL_ZERO
    unicFarm.uptAge = BIG_DECIMAL_ZERO
    unicFarm.uptAgeRemoved = BIG_DECIMAL_ZERO
    unicFarm.uptDeposited = BIG_DECIMAL_ZERO
    unicFarm.uptWithdrawn = BIG_DECIMAL_ZERO

    unicFarm.updatedAt = block.timestamp

    unicFarm.save()
  }

  return unicFarm as UnicFarm
}

export function getPool(id: BigInt, block: ethereum.Block): Pool {
  let pool = Pool.load(id.toString())

  if (pool === null) {
    const unicFarm = getUnicFarm(block)

    const unicFarmContract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

    // Create new pool.
    pool = new Pool(id.toString())

    // Set relation
    pool.owner = unicFarm.id

    const poolInfo = unicFarmContract.poolInfo(unicFarm.poolCount)

    pool.pair = poolInfo.value0
    pool.allocPoint = poolInfo.value1
    pool.lastRewardBlock = poolInfo.value2
    pool.accUnicPerShare = poolInfo.value3

    // Total supply of LP tokens
    pool.balance = BIG_INT_ZERO
    pool.userCount = BIG_INT_ZERO

    pool.uptBalance = BIG_DECIMAL_ZERO
    pool.uptAge = BIG_DECIMAL_ZERO
    pool.uptAgeRemoved = BIG_DECIMAL_ZERO
    pool.uptDeposited = BIG_DECIMAL_ZERO
    pool.uptWithdrawn = BIG_DECIMAL_ZERO

    pool.timestamp = block.timestamp
    pool.block = block.number

    pool.updatedAt = block.timestamp
    pool.entryUSD = BIG_DECIMAL_ZERO
    pool.exitUSD = BIG_DECIMAL_ZERO
    pool.unicHarvested = BIG_DECIMAL_ZERO
    pool.unicHarvestedUSD = BIG_DECIMAL_ZERO
    pool.save()
  }

  return pool as Pool
}

function getHistory(owner: string, block: ethereum.Block): History {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = owner.concat(day.toString())

  let history = History.load(id)

  if (history === null) {
    history = new History(id)
    history.owner = owner
    history.uptBalance = BIG_DECIMAL_ZERO
    history.uptAge = BIG_DECIMAL_ZERO
    history.uptAgeRemoved = BIG_DECIMAL_ZERO
    history.uptDeposited = BIG_DECIMAL_ZERO
    history.uptWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
  }

  return history as History
}

function getPoolHistory(pool: Pool, block: ethereum.Block): PoolHistory {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = pool.id.concat(day.toString())

  let history = PoolHistory.load(id)

  if (history === null) {
    history = new PoolHistory(id)
    history.pool = pool.id
    history.uptBalance = BIG_DECIMAL_ZERO
    history.uptAge = BIG_DECIMAL_ZERO
    history.uptAgeRemoved = BIG_DECIMAL_ZERO
    history.uptDeposited = BIG_DECIMAL_ZERO
    history.uptWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
    history.entryUSD = BIG_DECIMAL_ZERO
    history.exitUSD = BIG_DECIMAL_ZERO
    history.unicHarvested = BIG_DECIMAL_ZERO
    history.unicHarvestedUSD = BIG_DECIMAL_ZERO
  }

  return history as PoolHistory
}

export function getUser(pid: BigInt, address: Address, block: ethereum.Block): User {
  const uid = address.toHex()
  const id = pid.toString().concat('-').concat(uid)

  let user = User.load(id)

  if (user === null) {
    user = new User(id)
    user.pool = null
    user.address = address
    user.amount = BIG_INT_ZERO
    user.rewardDebt = BIG_INT_ZERO
    user.unicAtLockup = BIG_DECIMAL_ZERO
    user.unicHarvested = BIG_DECIMAL_ZERO
    user.unicHarvestedUSD = BIG_DECIMAL_ZERO
    user.unicHarvestedSinceLockup = BIG_DECIMAL_ZERO
    user.unicHarvestedSinceLockupUSD = BIG_DECIMAL_ZERO
    user.entryUSD = BIG_DECIMAL_ZERO
    user.exitUSD = BIG_DECIMAL_ZERO
    user.timestamp = block.timestamp
    user.block = block.number
    user.save()
  }

  return user as User
}

export function add(event: Add): void {
  const unicFarm = getUnicFarm(event.block)
  const contract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  log.info('Add pool #{}', [unicFarm.poolCount.toString()])

  const pool = getPool(unicFarm.poolCount, event.block)

  // Update UnicFarm.
  unicFarm.totalAllocPoint = unicFarm.totalAllocPoint.plus(pool.allocPoint)
  unicFarm.poolCount = unicFarm.poolCount.plus(BIG_INT_ONE)
  unicFarm.unicPerBlock = contract.unicPerBlock()
  unicFarm.save()
}

// Calls
export function set(event: Set): void {
  log.info('Set pool id: {} allocPoint: {} withUpdate: {}', [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.withUpdate ? 'true' : 'false',
  ])

  const pool = getPool(event.params.pid, event.block)
  const contract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const unicFarm = getUnicFarm(event.block)

  // Update masterchef
  unicFarm.totalAllocPoint = unicFarm.totalAllocPoint.plus(event.params.allocPoint.minus(pool.allocPoint))
  unicFarm.unicPerBlock = contract.unicPerBlock()
  unicFarm.save()

  // Update pool
  pool.allocPoint = event.params.allocPoint
  pool.save()
}

/*export function setMigrator(call: SetMigratorCall): void {
  log.info('Set migrator to {}', [call.inputs._migrator.toHex()])

  const unicFarm = getUnicFarm(call.block)
  unicFarm.migrator = call.inputs._migrator
  unicFarm.save()
}

export function migrate(call: MigrateCall): void {
  const unicFarmContract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const pool = getPool(call.inputs._pid, call.block)

  const poolInfo = unicFarmContract.poolInfo(call.inputs._pid)

  const pair = poolInfo.value0

  const pairContract = PairContract.bind(pair as Address)

  pool.pair = pair

  const balance = pairContract.balanceOf(MASTER_CHEF_ADDRESS)

  pool.balance = balance

  pool.save()
}*/

export function massUpdatePools(event: MassUpdatePools): void {
  log.info('Mass update pools', [])
}

export function updatePool(event: UpdatePool): void {
  log.info('Update pool id {}', [event.params.pid.toString()])

  const unicFarm = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)
  const poolInfo = unicFarm.poolInfo(event.params.pid)
  const pool = getPool(event.params.pid, event.block)
  pool.lastRewardBlock = poolInfo.value2
  pool.accUnicPerShare = poolInfo.value3
  pool.save()
}

export function dev(event: Dev): void {
  log.info('Dev changed to {}', [event.params.devaddr.toHex()])

  const unicFarm = getUnicFarm(event.block)

  unicFarm.devaddr = event.params.devaddr

  unicFarm.save()
}

// Events
export function deposit(event: Deposit): void {
  // if (event.params.amount == BIG_INT_ZERO) {
  //   log.info('Deposit zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  // log.info('{} has deposited {} upt tokens to pool #{}', [
  //   event.params.user.toHex(),
  //   event.params.amount.toString(),
  //   event.params.pid.toString(),
  // ])

  const unicFarmContract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const poolInfo = unicFarmContract.poolInfo(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const pairContract = PairContract.bind(poolInfo.value0)
  pool.balance = pairContract.balanceOf(MASTER_CHEF_ADDRESS)

  pool.lastRewardBlock = poolInfo.value2
  pool.accUnicPerShare = poolInfo.value3

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  pool.uptAge = pool.uptAge.plus(poolDays.times(pool.uptBalance))

  pool.uptDeposited = pool.uptDeposited.plus(amount)
  pool.uptBalance = pool.uptBalance.plus(amount)

  pool.updatedAt = event.block.timestamp

  const userInfo = unicFarmContract.userInfo(event.params.pid, event.params.user)

  const user = getUser(event.params.pid, event.params.user, event.block)

  // If not currently in pool and depositing SLP
  if (!user.pool && event.params.amount.gt(BIG_INT_ZERO)) {
    user.pool = pool.id
    pool.userCount = pool.userCount.plus(BIG_INT_ONE)
  }

  // Calculate SUSHI being paid out
  if (event.block.number.gt(MASTER_CHEF_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accUnicPerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Deposit: User amount is more than zero, we should harvest {} unic', [pending.toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI', [pending.toString()])
      const unicHarvestedUSD = pending.times(getUnicPrice(event.block))
      user.unicHarvested = user.unicHarvested.plus(pending)
      user.unicHarvestedUSD = user.unicHarvestedUSD.plus(unicHarvestedUSD)
      if (event.block.number.ge(LOCKUP_BLOCK_NUMBER)) {
        user.unicHarvestedSinceLockup = user.unicHarvestedSinceLockup.plus(pending)
        user.unicHarvestedSinceLockupUSD = user.unicHarvestedSinceLockupUSD.plus(unicHarvestedUSD)
      }
      pool.unicHarvested = pool.unicHarvested.plus(pending)
      pool.unicHarvestedUSD = pool.unicHarvestedUSD.plus(unicHarvestedUSD)
      poolHistory.unicHarvested = pool.unicHarvested
      poolHistory.unicHarvestedUSD = pool.unicHarvestedUSD
    }
  }

  user.amount = userInfo.value0
  user.rewardDebt = userInfo.value1

  if (event.params.amount.gt(BIG_INT_ZERO)) {
    const reservesResult = pairContract.try_getReserves()
    if (!reservesResult.reverted) {
      const totalSupply = pairContract.totalSupply()

      const share = amount.div(totalSupply.toBigDecimal())

      const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

      const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

      const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

      const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

      const token0USD = token0Amount.times(token0PriceUSD)

      const token1USD = token1Amount.times(token1PriceUSD)

      const entryUSD = token0USD.plus(token1USD)

      // log.info(
      //   'Token {} priceUSD: {} reserve: {} amount: {} / Token {} priceUSD: {} reserve: {} amount: {} - upt amount: {} total supply: {} share: {}',
      //   [
      //     token0.symbol(),
      //     token0PriceUSD.toString(),
      //     reservesResult.value.value0.toString(),
      //     token0Amount.toString(),
      //     token1.symbol(),
      //     token1PriceUSD.toString(),
      //     reservesResult.value.value1.toString(),
      //     token1Amount.toString(),
      //     amount.toString(),
      //     totalSupply.toString(),
      //     share.toString(),
      //   ]
      // )

      // log.info('User {} has deposited {} SLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
      //   user.address.toHex(),
      //   amount.toString(),
      //   token0Amount.toString(),
      //   token0.symbol(),
      //   token0USD.toString(),
      //   token1Amount.toString(),
      //   token1.symbol(),
      //   token1USD.toString(),
      //   entryUSD.toString(),
      // ])

      user.entryUSD = user.entryUSD.plus(entryUSD)

      pool.entryUSD = pool.entryUSD.plus(entryUSD)

      poolHistory.entryUSD = pool.entryUSD
    }
  }

  user.save()
  pool.save()

  const unicFarm = getUnicFarm(event.block)
  const contract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const unicFarmDays = event.block.timestamp.minus(unicFarm.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  unicFarm.uptAge = unicFarm.uptAge.plus(unicFarmDays.times(unicFarm.uptBalance))

  unicFarm.uptDeposited = unicFarm.uptDeposited.plus(amount)
  unicFarm.uptBalance = unicFarm.uptBalance.plus(amount)
  unicFarm.unicPerBlock = contract.unicPerBlock()

  unicFarm.updatedAt = event.block.timestamp
  unicFarm.save()

  const history = getHistory(MASTER_CHEF_ADDRESS.toHex(), event.block)
  history.uptAge = unicFarm.uptAge
  history.uptBalance = unicFarm.uptBalance
  history.uptDeposited = history.uptDeposited.plus(amount)
  history.save()

  poolHistory.uptAge = pool.uptAge
  poolHistory.uptBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.uptDeposited = poolHistory.uptDeposited.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

export function withdraw(event: Withdraw): void {
  // if (event.params.amount == BIG_INT_ZERO && User.load(event.params.user.toHex()) !== null) {
  //   log.info('Withdrawal zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  // log.info('{} has withdrawn {} upt tokens from pool #{}', [
  //   event.params.user.toHex(),
  //   amount.toString(),
  //   event.params.pid.toString(),
  // ])

  const unicFarmContract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const poolInfo = unicFarmContract.poolInfo(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const pairContract = PairContract.bind(poolInfo.value0)
  pool.balance = pairContract.balanceOf(MASTER_CHEF_ADDRESS)
  pool.lastRewardBlock = poolInfo.value2
  pool.accUnicPerShare = poolInfo.value3

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const poolAge = pool.uptAge.plus(poolDays.times(pool.uptBalance))
  const poolAgeRemoved = poolAge.div(pool.uptBalance).times(amount)
  pool.uptAge = poolAge.minus(poolAgeRemoved)
  pool.uptAgeRemoved = pool.uptAgeRemoved.plus(poolAgeRemoved)
  pool.uptWithdrawn = pool.uptWithdrawn.plus(amount)
  pool.uptBalance = pool.uptBalance.minus(amount)
  pool.updatedAt = event.block.timestamp

  const user = getUser(event.params.pid, event.params.user, event.block)

  if (event.block.number.gt(MASTER_CHEF_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accUnicPerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Withdraw: User amount is more than zero, we should harvest {} unic - block: {}', [
    //   pending.toString(),
    //   event.block.number.toString(),
    // ])
    // log.info('SUSHI PRICE {}', [getSushiPrice(event.block).toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI (CURRENT SUSHI PRICE {})', [
      //   pending.toString(),
      //   getSushiPrice(event.block).toString(),
      // ])
      const unicHarvestedUSD = pending.times(getUnicPrice(event.block))
      user.unicHarvested = user.unicHarvested.plus(pending)
      user.unicHarvestedUSD = user.unicHarvestedUSD.plus(unicHarvestedUSD)
      if (event.block.number.ge(LOCKUP_BLOCK_NUMBER)) {
        user.unicHarvestedSinceLockup = user.unicHarvestedSinceLockup.plus(pending)
        user.unicHarvestedSinceLockupUSD = user.unicHarvestedSinceLockupUSD.plus(unicHarvestedUSD)
      }
      pool.unicHarvested = pool.unicHarvested.plus(pending)
      pool.unicHarvestedUSD = pool.unicHarvestedUSD.plus(unicHarvestedUSD)
      poolHistory.unicHarvested = pool.unicHarvested
      poolHistory.unicHarvestedUSD = pool.unicHarvestedUSD
    }
  }

  const userInfo = unicFarmContract.userInfo(event.params.pid, event.params.user)

  user.amount = userInfo.value0
  user.rewardDebt = userInfo.value1

  if (event.params.amount.gt(BIG_INT_ZERO)) {
    const reservesResult = pairContract.try_getReserves()

    if (!reservesResult.reverted) {
      const totalSupply = pairContract.totalSupply()

      const share = amount.div(totalSupply.toBigDecimal())

      const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

      const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

      const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

      const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

      const token0USD = token0Amount.times(token0PriceUSD)

      const token1USD = token1Amount.times(token1PriceUSD)

      const exitUSD = token0USD.plus(token1USD)

      pool.exitUSD = pool.exitUSD.plus(exitUSD)

      poolHistory.exitUSD = pool.exitUSD

      // log.info('User {} has withdrwn {} SLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
      //   user.address.toHex(),
      //   amount.toString(),
      //   token0Amount.toString(),
      //   token0USD.toString(),
      //   pairContract.token0().toHex(),
      //   token1Amount.toString(),
      //   token1USD.toString(),
      //   pairContract.token1().toHex(),
      //   exitUSD.toString(),
      // ])

      user.exitUSD = user.exitUSD.plus(exitUSD)
    } else {
      log.info("Withdraw couldn't get reserves for pair {}", [poolInfo.value0.toHex()])
    }
  }

  // If SLP amount equals zero, remove from pool and reduce userCount
  if (user.amount.equals(BIG_INT_ZERO)) {
    user.pool = null
    pool.userCount = pool.userCount.minus(BIG_INT_ONE)
  }

  user.save()
  pool.save()

  const unicFarm = getUnicFarm(event.block)
  const contract = UnicFarmContract.bind(MASTER_CHEF_ADDRESS)

  const days = event.block.timestamp.minus(unicFarm.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const uptAge = unicFarm.uptAge.plus(days.times(unicFarm.uptBalance))
  const uptAgeRemoved = uptAge.div(unicFarm.uptBalance).times(amount)
  unicFarm.uptAge = uptAge.minus(uptAgeRemoved)
  unicFarm.uptAgeRemoved = unicFarm.uptAgeRemoved.plus(uptAgeRemoved)
  unicFarm.unicPerBlock = contract.unicPerBlock()

  unicFarm.uptWithdrawn = unicFarm.uptWithdrawn.plus(amount)
  unicFarm.uptBalance = unicFarm.uptBalance.minus(amount)
  unicFarm.updatedAt = event.block.timestamp
  unicFarm.save()

  const history = getHistory(MASTER_CHEF_ADDRESS.toHex(), event.block)
  history.uptAge = unicFarm.uptAge
  history.uptAgeRemoved = history.uptAgeRemoved.plus(uptAgeRemoved)
  history.uptBalance = unicFarm.uptBalance
  history.uptWithdrawn = history.uptWithdrawn.plus(amount)
  history.save()

  poolHistory.uptAge = pool.uptAge
  poolHistory.uptAgeRemoved = poolHistory.uptAgeRemoved.plus(uptAgeRemoved)
  poolHistory.uptBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.uptWithdrawn = poolHistory.uptWithdrawn.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

export function emergencyWithdraw(event: EmergencyWithdraw): void {
  log.info('User {} emergancy withdrawal of {} from pool #{}', [
    event.params.user.toHex(),
    event.params.amount.toString(),
    event.params.pid.toString(),
  ])

  const pool = getPool(event.params.pid, event.block)

  const pairContract = PairContract.bind(pool.pair as Address)
  pool.balance = pairContract.balanceOf(MASTER_CHEF_ADDRESS)
  pool.save()

  // Update user
  const user = getUser(event.params.pid, event.params.user, event.block)
  user.amount = BIG_INT_ZERO
  user.rewardDebt = BIG_INT_ZERO

  user.save()
}

export function ownershipTransferred(event: OwnershipTransferred): void {
  log.info('Ownership transfered from previous owner: {} to new owner: {}', [
    event.params.previousOwner.toHex(),
    event.params.newOwner.toHex(),
  ])
}
