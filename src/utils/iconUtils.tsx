import * as React from "react"
import AmazonIcon from "../assets/icons/amazon.svg?react"
import DigitecGalaxusIcon from "../assets/icons/digitec-galaxus.svg?react"
import GithubIcon from "../assets/icons/github.svg?react"
import InstagramIcon from "../assets/icons/instagram.svg?react"
import LinkIcon from "../assets/icons/globe.svg?react"
import XIcon from "../assets/icons/x.svg?react"
import YoutubeIcon from "../assets/icons/youtube.svg?react"

const isSubdomain = (hostname: string, domain: string): boolean => {
  if (hostname === domain) return true
  if (!hostname.endsWith(domain)) return false
  const prefixLength = hostname.length - domain.length
  return hostname.charAt(prefixLength - 1) === "."
}

export const getBookmarkIcon = (url?: string): React.JSX.Element => {
  if (!url) return <LinkIcon />

  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return <LinkIcon />
  }

  if (isSubdomain(hostname, "youtube.com")) return <YoutubeIcon />
  if (
    ["amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de"].some((d) =>
      isSubdomain(hostname, d),
    )
  )
    return <AmazonIcon />
  if (isSubdomain(hostname, "github.com")) return <GithubIcon />
  if (["digitec.ch", "galaxus.ch"].some((d) => isSubdomain(hostname, d)))
    return <DigitecGalaxusIcon />
  if (isSubdomain(hostname, "instagram.com")) return <InstagramIcon />
  if (isSubdomain(hostname, "twitter.com") || isSubdomain(hostname, "x.com"))
    return <XIcon />

  return <LinkIcon />
}
