import { useEffect } from 'react'

const DEFAULT_DESCRIPTION =
  'Quorum is a public dashboard for reading live prediction market sentiment.'
const SITE_NAME = 'Quorum'

export type PageMetadataInput = {
  canonicalPath?: string
  description?: string
  imageUrl?: string
  jsonLd?: Record<string, unknown> | null
  title: string
}

function buildAbsoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl || typeof window === 'undefined') {
    return null
  }

  return new URL(pathOrUrl, window.location.origin).toString()
}

function upsertMetaTag(input: {
  content: string
  name?: string
  property?: string
}) {
  if (!input.name && !input.property) {
    return
  }

  const selector = input.name
    ? `meta[name="${input.name}"]`
    : `meta[property="${input.property}"]`
  let element = document.head.querySelector(selector) as HTMLMetaElement | null

  if (!element) {
    element = document.createElement('meta')

    if (input.name) {
      element.setAttribute('name', input.name)
    }

    if (input.property) {
      element.setAttribute('property', input.property)
    }

    document.head.appendChild(element)
  }

  element.setAttribute('content', input.content)
}

function upsertCanonicalLink(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', href)
}

export function usePageMetadata(input: PageMetadataInput) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const description = input.description?.trim() || DEFAULT_DESCRIPTION
    const canonicalUrl =
      buildAbsoluteUrl(input.canonicalPath) ?? window.location.href
    const imageUrl = buildAbsoluteUrl(input.imageUrl)
    const jsonLdSelector = 'script[data-quorum-jsonld="page"]'

    document.title = input.title

    upsertMetaTag({
      content: description,
      name: 'description',
    })
    upsertMetaTag({
      content: input.title,
      property: 'og:title',
    })
    upsertMetaTag({
      content: description,
      property: 'og:description',
    })
    upsertMetaTag({
      content: canonicalUrl,
      property: 'og:url',
    })
    upsertMetaTag({
      content: SITE_NAME,
      property: 'og:site_name',
    })
    upsertMetaTag({
      content: 'website',
      property: 'og:type',
    })
    upsertMetaTag({
      content: imageUrl ? 'summary_large_image' : 'summary',
      name: 'twitter:card',
    })
    upsertMetaTag({
      content: input.title,
      name: 'twitter:title',
    })
    upsertMetaTag({
      content: description,
      name: 'twitter:description',
    })

    if (imageUrl) {
      upsertMetaTag({
        content: imageUrl,
        property: 'og:image',
      })
      upsertMetaTag({
        content: imageUrl,
        name: 'twitter:image',
      })
    }

    upsertCanonicalLink(canonicalUrl)

    const existingJsonLd = document.head.querySelector(jsonLdSelector)

    if (input.jsonLd) {
      let element = existingJsonLd as HTMLScriptElement | null

      if (!element) {
        element = document.createElement('script')
        element.type = 'application/ld+json'
        element.setAttribute('data-quorum-jsonld', 'page')
        document.head.appendChild(element)
      }

      element.textContent = JSON.stringify(input.jsonLd)
    } else if (existingJsonLd) {
      existingJsonLd.remove()
    }
  }, [
    input.canonicalPath,
    input.description,
    input.imageUrl,
    input.jsonLd,
    input.title,
  ])
}
