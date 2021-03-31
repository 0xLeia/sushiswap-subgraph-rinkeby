import {
  ADDRESS_ZERO,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_1E6,
  BIG_DECIMAL_ZERO,
  BIG_INT_ZERO,
  SUSHI_BAR_ADDRESS,
  SUSHI_TOKEN_ADDRESS,
  SUSHI_USDT_PAIR_ADDRESS,
} from './constants'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import { UnicGallery, History, User } from '../generated/schema'
import { UnicGallery as BarContract, Transfer as TransferEvent } from '../generated/UnicGallery/UnicGallery'

import { Pair as PairContract } from '../generated/UnicGallery/Pair'
import { SushiToken as UnicTokenContract } from '../generated/UnicGallery/SushiToken'

// TODO: Get averages of multiple unic stablecoin pairs
function getUnicPrice(): BigDecimal {
  const pair = PairContract.bind(SUSHI_USDT_PAIR_ADDRESS)
  const reserves = pair.getReserves()
  return reserves.value1.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value0.toBigDecimal()).div(BIG_DECIMAL_1E6)
}

function createBar(block: ethereum.Block): UnicGallery {
  const contract = BarContract.bind(dataSource.address())
  const bar = new UnicGallery(dataSource.address().toHex())
  bar.decimals = contract.decimals()
  bar.name = contract.name()
  bar.unic = contract.unic()
  bar.symbol = contract.symbol()
  bar.totalSupply = BIG_DECIMAL_ZERO
  bar.unicStaked = BIG_DECIMAL_ZERO
  bar.unicStakedUSD = BIG_DECIMAL_ZERO
  bar.unicHarvested = BIG_DECIMAL_ZERO
  bar.unicHarvestedUSD = BIG_DECIMAL_ZERO
  bar.xUnicMinted = BIG_DECIMAL_ZERO
  bar.xUnicBurned = BIG_DECIMAL_ZERO
  bar.xUnicAge = BIG_DECIMAL_ZERO
  bar.xUnicAgeDestroyed = BIG_DECIMAL_ZERO
  bar.ratio = BIG_DECIMAL_ZERO
  bar.updatedAt = block.timestamp
  bar.save()

  return bar as UnicGallery
}

function getBar(block: ethereum.Block): UnicGallery {
  let bar = UnicGallery.load(dataSource.address().toHex())

  if (bar === null) {
    bar = createBar(block)
  }

  return bar as UnicGallery
}

function createUser(address: Address, block: ethereum.Block): User {
  const user = new User(address.toHex())

  // Set relation to bar
  user.bar = dataSource.address().toHex()

  user.xUnic = BIG_DECIMAL_ZERO
  user.xUnicMinted = BIG_DECIMAL_ZERO
  user.xUnicBurned = BIG_DECIMAL_ZERO

  user.unicStaked = BIG_DECIMAL_ZERO
  user.unicStakedUSD = BIG_DECIMAL_ZERO

  user.unicHarvested = BIG_DECIMAL_ZERO
  user.unicHarvestedUSD = BIG_DECIMAL_ZERO

  // In/Out
  user.xUnicOut = BIG_DECIMAL_ZERO
  user.unicOut = BIG_DECIMAL_ZERO
  user.usdOut = BIG_DECIMAL_ZERO

  user.xUnicIn = BIG_DECIMAL_ZERO
  user.unicIn = BIG_DECIMAL_ZERO
  user.usdIn = BIG_DECIMAL_ZERO

  user.xUnicAge = BIG_DECIMAL_ZERO
  user.xUnicAgeDestroyed = BIG_DECIMAL_ZERO

  user.xUnicOffset = BIG_DECIMAL_ZERO
  user.unicOffset = BIG_DECIMAL_ZERO
  user.usdOffset = BIG_DECIMAL_ZERO
  user.updatedAt = block.timestamp

  return user as User
}

function getUser(address: Address, block: ethereum.Block): User {
  let user = User.load(address.toHex())

  if (user === null) {
    user = createUser(address, block)
  }

  return user as User
}

function getHistory(block: ethereum.Block): History {
  const day = block.timestamp.toI32() / 86400

  const id = BigInt.fromI32(day).toString()

  let history = History.load(id)

  if (history === null) {
    const date = day * 86400
    history = new History(id)
    history.date = date
    history.timeframe = 'Day'
    history.unicStaked = BIG_DECIMAL_ZERO
    history.unicStakedUSD = BIG_DECIMAL_ZERO
    history.unicHarvested = BIG_DECIMAL_ZERO
    history.unicHarvestedUSD = BIG_DECIMAL_ZERO
    history.xUnicAge = BIG_DECIMAL_ZERO
    history.xUnicAgeDestroyed = BIG_DECIMAL_ZERO
    history.xUnicMinted = BIG_DECIMAL_ZERO
    history.xUnicBurned = BIG_DECIMAL_ZERO
    history.xUnicSupply = BIG_DECIMAL_ZERO
    history.ratio = BIG_DECIMAL_ZERO
  }

  return history as History
}

export function transfer(event: TransferEvent): void {
  // Convert to BigDecimal with 18 places, 1e18.
  const value = event.params.value.divDecimal(BIG_DECIMAL_1E18)

  // If value is zero, do nothing.
  if (value.equals(BIG_DECIMAL_ZERO)) {
    log.warning('Transfer zero value! Value: {} Tx: {}', [
      event.params.value.toString(),
      event.transaction.hash.toHex(),
    ])
    return
  }

  const bar = getBar(event.block)
  const barContract = BarContract.bind(SUSHI_BAR_ADDRESS)

  const unicPrice = getUnicPrice()

  bar.totalSupply = barContract.totalSupply().divDecimal(BIG_DECIMAL_1E18)
  bar.unicStaked = UnicTokenContract.bind(SUSHI_TOKEN_ADDRESS)
    .balanceOf(SUSHI_BAR_ADDRESS)
    .divDecimal(BIG_DECIMAL_1E18)
  bar.ratio = bar.unicStaked.div(bar.totalSupply)

  const what = value.times(bar.ratio)

  // Minted xUnic
  if (event.params.from == ADDRESS_ZERO) {
    const user = getUser(event.params.to, event.block)

    log.info('{} minted {} xUnic in exchange for {} unic - unicStaked before {} unicStaked after {}', [
      event.params.to.toHex(),
      value.toString(),
      what.toString(),
      user.unicStaked.toString(),
      user.unicStaked.plus(what).toString(),
    ])

    if (user.xUnic == BIG_DECIMAL_ZERO) {
      log.info('{} entered the bar', [user.id])
      user.bar = bar.id
    }

    user.xUnicMinted = user.xUnicMinted.plus(value)

    const unicStakedUSD = what.times(unicPrice)

    user.unicStaked = user.unicStaked.plus(what)
    user.unicStakedUSD = user.unicStakedUSD.plus(unicStakedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xUnicAge = days.times(user.xUnic)

    user.xUnicAge = user.xUnicAge.plus(xUnicAge)

    // Update last
    user.xUnic = user.xUnic.plus(value)

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXunic = bar.xUnicMinted.minus(bar.xUnicBurned)
    bar.xUnicMinted = bar.xUnicMinted.plus(value)
    bar.xUnicAge = bar.xUnicAge.plus(barDays.times(barXunic))
    bar.unicStaked = bar.unicStaked.plus(what)
    bar.unicStakedUSD = bar.unicStakedUSD.plus(unicStakedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xUnicAge = bar.xUnicAge
    history.xUnicMinted = history.xUnicMinted.plus(value)
    history.xUnicSupply = bar.totalSupply
    history.unicStaked = history.unicStaked.plus(what)
    history.unicStakedUSD = history.unicStakedUSD.plus(unicStakedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // Burned xUnic
  if (event.params.to == ADDRESS_ZERO) {
    log.info('{} burned {} xUnic', [event.params.from.toHex(), value.toString()])

    const user = getUser(event.params.from, event.block)

    user.xUnicBurned = user.xUnicBurned.plus(value)

    user.unicHarvested = user.unicHarvested.plus(what)

    const unicHarvestedUSD = what.times(unicPrice)

    user.unicHarvestedUSD = user.unicHarvestedUSD.plus(unicHarvestedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xUnicAge = days.times(user.xUnic)

    user.xUnicAge = user.xUnicAge.plus(xUnicAge)

    const xUnicAgeDestroyed = user.xUnicAge.div(user.xUnic).times(value)

    user.xUnicAgeDestroyed = user.xUnicAgeDestroyed.plus(xUnicAgeDestroyed)

    // Update xUnic last
    user.xUnic = user.xUnic.minus(value)

    if (user.xUnic == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar', [user.id])
      user.bar = null
    }

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXunic = bar.xUnicMinted.minus(bar.xUnicBurned)
    bar.xUnicBurned = bar.xUnicBurned.plus(value)
    bar.xUnicAge = bar.xUnicAge.plus(barDays.times(barXunic)).minus(xUnicAgeDestroyed)
    bar.xUnicAgeDestroyed = bar.xUnicAgeDestroyed.plus(xUnicAgeDestroyed)
    bar.unicHarvested = bar.unicHarvested.plus(what)
    bar.unicHarvestedUSD = bar.unicHarvestedUSD.plus(unicHarvestedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xUnicSupply = bar.totalSupply
    history.xUnicBurned = history.xUnicBurned.plus(value)
    history.xUnicAge = bar.xUnicAge
    history.xUnicAgeDestroyed = history.xUnicAgeDestroyed.plus(xUnicAgeDestroyed)
    history.unicHarvested = history.unicHarvested.plus(what)
    history.unicHarvestedUSD = history.unicHarvestedUSD.plus(unicHarvestedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // If transfer from address to address and not known xUnic pools.
  if (event.params.from != ADDRESS_ZERO && event.params.to != ADDRESS_ZERO) {
    log.info('transfered {} xUnic from {} to {}', [
      value.toString(),
      event.params.from.toHex(),
      event.params.to.toHex(),
    ])

    const fromUser = getUser(event.params.from, event.block)

    const fromUserDays = event.block.timestamp.minus(fromUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    // Recalc xUnic age first
    fromUser.xUnicAge = fromUser.xUnicAge.plus(fromUserDays.times(fromUser.xUnic))
    // Calculate xUnicAge being transfered
    const xUnicAgeTranfered = fromUser.xUnicAge.div(fromUser.xUnic).times(value)
    // Subtract from xUnicAge
    fromUser.xUnicAge = fromUser.xUnicAge.minus(xUnicAgeTranfered)
    fromUser.updatedAt = event.block.timestamp

    fromUser.xUnic = fromUser.xUnic.minus(value)
    fromUser.xUnicOut = fromUser.xUnicOut.plus(value)
    fromUser.unicOut = fromUser.unicOut.plus(what)
    fromUser.usdOut = fromUser.usdOut.plus(what.times(unicPrice))

    if (fromUser.xUnic == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar by transfer OUT', [fromUser.id])
      fromUser.bar = null
    }

    fromUser.save()

    const toUser = getUser(event.params.to, event.block)

    if (toUser.bar === null) {
      log.info('{} entered the bar by transfer IN', [fromUser.id])
      toUser.bar = bar.id
    }

    // Recalculate xUnic age and add incoming xUnicAgeTransfered
    const toUserDays = event.block.timestamp.minus(toUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    toUser.xUnicAge = toUser.xUnicAge.plus(toUserDays.times(toUser.xUnic)).plus(xUnicAgeTranfered)
    toUser.updatedAt = event.block.timestamp

    toUser.xUnic = toUser.xUnic.plus(value)
    toUser.xUnicIn = toUser.xUnicIn.plus(value)
    toUser.unicIn = toUser.unicIn.plus(what)
    toUser.usdIn = toUser.usdIn.plus(what.times(unicPrice))

    const difference = toUser.xUnicIn.minus(toUser.xUnicOut).minus(toUser.xUnicOffset)

    // If difference of unic in - unic out - offset > 0, then add on the difference
    // in staked unic based on xUnic:Unic ratio at time of reciept.
    if (difference.gt(BIG_DECIMAL_ZERO)) {
      const unic = toUser.unicIn.minus(toUser.unicOut).minus(toUser.unicOffset)
      const usd = toUser.usdIn.minus(toUser.usdOut).minus(toUser.usdOffset)

      log.info('{} recieved a transfer of {} xUnic from {}, unic value of transfer is {}', [
        toUser.id,
        value.toString(),
        fromUser.id,
        what.toString(),
      ])

      toUser.unicStaked = toUser.unicStaked.plus(unic)
      toUser.unicStakedUSD = toUser.unicStakedUSD.plus(usd)

      toUser.xUnicOffset = toUser.xUnicOffset.plus(difference)
      toUser.unicOffset = toUser.unicOffset.plus(unic)
      toUser.usdOffset = toUser.usdOffset.plus(usd)
    }

    toUser.save()
  }

  bar.save()
}
