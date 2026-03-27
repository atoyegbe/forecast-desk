import { createHash } from 'node:crypto'
import type {
  PulseEvent,
  PulseMatchMethod,
  PulseProvider,
} from '../contracts/pulse-events.js'
import type { StoredEventLinkInput } from '../db/link-repository.js'

type TokenProfile = {
  normalizedTitle: string
  signature: string
  tokens: string[]
}

type MatchCandidate = {
  events: [PulseEvent, PulseEvent]
  matchMethod: PulseMatchMethod
  score: number
}

type MutableEventLink = {
  category: string
  confidence: number
  eventIds: Set<string>
  matchMethod: PulseMatchMethod
}

const TITLE_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'before',
  'between',
  'by',
  'end',
  'for',
  'from',
  'get',
  'how',
  'if',
  'in',
  'into',
  'is',
  'many',
  'of',
  'on',
  'or',
  'than',
  'that',
  'the',
  'their',
  'this',
  'to',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
])

const TOKEN_ALIASES = new Map<string, string>([
  ['champion', 'win'],
  ['champions', 'win'],
  ['championship', 'win'],
  ['finals', 'final'],
  ['goalscorer', 'scorer'],
  ['goalscorers', 'scorer'],
  ['launched', 'launch'],
  ['launches', 'launch'],
  ['released', 'release'],
  ['releases', 'release'],
  ['retires', 'retire'],
  ['retired', 'retire'],
  ['title', 'win'],
  ['titles', 'win'],
  ['winner', 'win'],
  ['winners', 'win'],
  ['winning', 'win'],
  ['won', 'win'],
])

const TITLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bepl\b/g, 'english premier league'],
  [/\bu\.?k\.?\b/g, 'united kingdom'],
  [/\bu\.?s\.?a?\b/g, 'united states'],
  [/\bman utd\b/g, 'manchester united'],
]

function normalizeTitle(title: string) {
  let normalized = title.toLowerCase()

  for (const [pattern, replacement] of TITLE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeTitle(title: string) {
  return normalizeTitle(title)
    .split(/\s+/)
    .map((token) => TOKEN_ALIASES.get(token) ?? token)
    .filter((token) => !TITLE_STOPWORDS.has(token))
    .filter((token) => token.length > 1 || /\d/.test(token))
}

function buildTokenProfile(event: PulseEvent): TokenProfile {
  const tokens = Array.from(new Set(tokenizeTitle(event.title)))

  return {
    normalizedTitle: normalizeTitle(event.title),
    signature: [...tokens].sort().join('|'),
    tokens,
  }
}

function buildTokenWeights(events: PulseEvent[], tokenProfiles: Map<string, TokenProfile>) {
  const documentFrequency = new Map<string, number>()

  for (const event of events) {
    const profile = tokenProfiles.get(event.id)

    if (!profile) {
      continue
    }

    for (const token of profile.tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
    }
  }

  const totalDocuments = Math.max(1, events.length)
  const tokenWeights = new Map<string, number>()

  for (const [token, frequency] of documentFrequency) {
    tokenWeights.set(token, Math.log((1 + totalDocuments) / (1 + frequency)) + 1)
  }

  return tokenWeights
}

function getResolutionTarget(event: PulseEvent) {
  return event.resolutionDate ?? event.closingDate ?? null
}

function getDateClosenessScore(leftEvent: PulseEvent, rightEvent: PulseEvent) {
  const leftDate = getResolutionTarget(leftEvent)
  const rightDate = getResolutionTarget(rightEvent)

  if (!leftDate || !rightDate) {
    return {
      score: 0,
      valid: true,
    }
  }

  const daysDifference =
    Math.abs(new Date(leftDate).getTime() - new Date(rightDate).getTime()) /
    (1000 * 60 * 60 * 24)

  if (daysDifference > 14) {
    return {
      score: 0,
      valid: false,
    }
  }

  if (daysDifference <= 3) {
    return {
      score: 0.12,
      valid: true,
    }
  }

  if (daysDifference <= 7) {
    return {
      score: 0.06,
      valid: true,
    }
  }

  return {
    score: 0.02,
    valid: true,
  }
}

function scoreCandidatePair(
  leftEvent: PulseEvent,
  rightEvent: PulseEvent,
  tokenProfiles: Map<string, TokenProfile>,
  tokenWeights: Map<string, number>,
) {
  const leftProfile = tokenProfiles.get(leftEvent.id)
  const rightProfile = tokenProfiles.get(rightEvent.id)

  if (!leftProfile || !rightProfile) {
    return null
  }

  const dateScore = getDateClosenessScore(leftEvent, rightEvent)

  if (!dateScore.valid) {
    return null
  }

  if (leftProfile.signature && leftProfile.signature === rightProfile.signature) {
    return {
      events: [leftEvent, rightEvent] as [PulseEvent, PulseEvent],
      matchMethod: 'exact' as const,
      score: Number(Math.min(0.99, 0.94 + dateScore.score).toFixed(4)),
    }
  }

  const rightTokens = new Set(rightProfile.tokens)
  const overlappingTokens = leftProfile.tokens.filter((token) => rightTokens.has(token))

  if (overlappingTokens.length < 2) {
    return null
  }

  const leftWeight = leftProfile.tokens.reduce(
    (total, token) => total + (tokenWeights.get(token) ?? 1),
    0,
  )
  const rightWeight = rightProfile.tokens.reduce(
    (total, token) => total + (tokenWeights.get(token) ?? 1),
    0,
  )
  const overlapWeight = overlappingTokens.reduce(
    (total, token) => total + (tokenWeights.get(token) ?? 1),
    0,
  )
  const unionWeight = leftWeight + rightWeight - overlapWeight
  const weightedJaccard = unionWeight > 0 ? overlapWeight / unionWeight : 0
  const weightedCoverage =
    overlapWeight / Math.max(1, Math.min(leftWeight, rightWeight))
  const containsOther =
    leftProfile.normalizedTitle.includes(rightProfile.normalizedTitle) ||
    rightProfile.normalizedTitle.includes(leftProfile.normalizedTitle)
  const confidence =
    weightedJaccard * 0.55 +
    weightedCoverage * 0.35 +
    dateScore.score +
    (containsOther ? 0.08 : 0)

  if (weightedCoverage < 0.62) {
    return null
  }

  const threshold =
    getResolutionTarget(leftEvent) && getResolutionTarget(rightEvent) ? 0.74 : 0.82

  if (confidence < threshold) {
    return null
  }

  return {
    events: [leftEvent, rightEvent] as [PulseEvent, PulseEvent],
    matchMethod: 'fuzzy' as const,
    score: Number(Math.min(0.99, confidence).toFixed(4)),
  }
}

function findCandidatePairs(
  events: PulseEvent[],
  tokenProfiles: Map<string, TokenProfile>,
  tokenWeights: Map<string, number>,
) {
  const candidates: MatchCandidate[] = []

  for (let index = 0; index < events.length; index += 1) {
    const leftEvent = events[index]

    for (let innerIndex = index + 1; innerIndex < events.length; innerIndex += 1) {
      const rightEvent = events[innerIndex]

      if (leftEvent.provider === rightEvent.provider) {
        continue
      }

      if (leftEvent.category !== rightEvent.category) {
        continue
      }

      const candidate = scoreCandidatePair(
        leftEvent,
        rightEvent,
        tokenProfiles,
        tokenWeights,
      )

      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  return candidates.sort((leftCandidate, rightCandidate) => {
    if (rightCandidate.score !== leftCandidate.score) {
      return rightCandidate.score - leftCandidate.score
    }

    const leftVolume = leftCandidate.events[0].totalVolume + leftCandidate.events[1].totalVolume
    const rightVolume =
      rightCandidate.events[0].totalVolume + rightCandidate.events[1].totalVolume

    return rightVolume - leftVolume
  })
}

function getLinkProviders(
  link: MutableEventLink,
  eventsById: Map<string, PulseEvent>,
) {
  const providers = new Set<PulseProvider>()

  for (const eventId of link.eventIds) {
    const event = eventsById.get(eventId)

    if (event) {
      providers.add(event.provider)
    }
  }

  return providers
}

function chooseLinkTitle(eventIds: string[], eventsById: Map<string, PulseEvent>) {
  const events = eventIds
    .map((eventId) => eventsById.get(eventId))
    .filter((event): event is PulseEvent => Boolean(event))
    .sort((leftEvent, rightEvent) => rightEvent.totalVolume - leftEvent.totalVolume)

  return events[0]?.title ?? 'Linked event'
}

function toStoredEventLink(
  link: MutableEventLink,
  eventsById: Map<string, PulseEvent>,
): StoredEventLinkInput {
  const eventIds = [...link.eventIds].sort()

  return {
    category: link.category,
    confidence: Number(link.confidence.toFixed(4)),
    eventIds,
    id: `link__${createHash('sha1').update(eventIds.join('|')).digest('hex').slice(0, 16)}`,
    matchMethod: link.matchMethod,
    title: chooseLinkTitle(eventIds, eventsById),
  }
}

export function runEntityMatching(events: PulseEvent[]) {
  const openEvents = events.filter((event) => event.status === 'open')
  const tokenProfiles = new Map(
    openEvents.map((event) => [event.id, buildTokenProfile(event)]),
  )
  const tokenWeights = buildTokenWeights(openEvents, tokenProfiles)
  const candidates = findCandidatePairs(openEvents, tokenProfiles, tokenWeights)
  const eventsById = new Map(openEvents.map((event) => [event.id, event]))
  const links = new Map<string, MutableEventLink>()
  const eventToLink = new Map<string, string>()

  for (const candidate of candidates) {
    const [leftEvent, rightEvent] = candidate.events
    const leftLinkId = eventToLink.get(leftEvent.id)
    const rightLinkId = eventToLink.get(rightEvent.id)

    if (!leftLinkId && !rightLinkId) {
      const provisionalLinkId = `${leftEvent.id}|${rightEvent.id}`

      links.set(provisionalLinkId, {
        category: leftEvent.category,
        confidence: candidate.score,
        eventIds: new Set([leftEvent.id, rightEvent.id]),
        matchMethod: candidate.matchMethod,
      })
      eventToLink.set(leftEvent.id, provisionalLinkId)
      eventToLink.set(rightEvent.id, provisionalLinkId)
      continue
    }

    if (leftLinkId && !rightLinkId) {
      const link = links.get(leftLinkId)

      if (!link) {
        continue
      }

      const providers = getLinkProviders(link, eventsById)

      if (providers.has(rightEvent.provider)) {
        continue
      }

      link.eventIds.add(rightEvent.id)
      link.confidence = Math.max(link.confidence, candidate.score)
      if (candidate.matchMethod === 'exact') {
        link.matchMethod = 'exact'
      }
      eventToLink.set(rightEvent.id, leftLinkId)
      continue
    }

    if (!leftLinkId && rightLinkId) {
      const link = links.get(rightLinkId)

      if (!link) {
        continue
      }

      const providers = getLinkProviders(link, eventsById)

      if (providers.has(leftEvent.provider)) {
        continue
      }

      link.eventIds.add(leftEvent.id)
      link.confidence = Math.max(link.confidence, candidate.score)
      if (candidate.matchMethod === 'exact') {
        link.matchMethod = 'exact'
      }
      eventToLink.set(leftEvent.id, rightLinkId)
      continue
    }

    if (!leftLinkId || !rightLinkId || leftLinkId === rightLinkId) {
      continue
    }

    const leftLink = links.get(leftLinkId)
    const rightLink = links.get(rightLinkId)

    if (!leftLink || !rightLink) {
      continue
    }

    const leftProviders = getLinkProviders(leftLink, eventsById)
    const rightProviders = getLinkProviders(rightLink, eventsById)
    const hasProviderConflict = [...leftProviders].some((provider) => rightProviders.has(provider))

    if (hasProviderConflict) {
      continue
    }

    for (const eventId of rightLink.eventIds) {
      leftLink.eventIds.add(eventId)
      eventToLink.set(eventId, leftLinkId)
    }

    leftLink.confidence = Math.max(leftLink.confidence, rightLink.confidence, candidate.score)
    if (candidate.matchMethod === 'exact' || rightLink.matchMethod === 'exact') {
      leftLink.matchMethod = 'exact'
    }

    links.delete(rightLinkId)
  }

  return [...links.values()]
    .map((link) => toStoredEventLink(link, eventsById))
    .filter((link) => link.eventIds.length >= 2)
}
