import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SafeMarkdown } from './markdown'
describe('inert markdown', () => {
  it('does not emit images or clickable external URLs', () => {
    const html = renderToStaticMarkup(
      createElement(SafeMarkdown, {
        text: '![tracking](https://tracker.example/image.png) [link](https://example.com)',
      })
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<a ')
    expect(html).toContain('External image blocked')
    expect(html).toContain('Copy URL')
  })
  it('drops raw HTML scripts and unverified citation markers', () => {
    const html = renderToStaticMarkup(
      createElement(SafeMarkdown, { text: '<script>alert(1)</script>\n\nhello [[n:fake#madeup]]' })
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('[[n:')
    expect(html).not.toContain('citation-chip')
  })
  it('renders verified section references as local buttons', () => {
    const html = renderToStaticMarkup(
      createElement(SafeMarkdown, {
        text: 'Evidence [[n:n01#n01-c1]]',
        citations: [
          { note_id: 'n01', chunk_id: 'n01-c1', heading: 'Advertising routes', score: 0.95 },
        ],
      })
    )
    expect(html).toContain('citation-chip')
    expect(html).toContain('Advertising routes')
    expect(html).not.toContain('<a ')
  })
})
