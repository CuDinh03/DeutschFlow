import { afterEach, describe, expect, it, vi } from 'vitest'
import { breadcrumbStructuredData, websiteStructuredData } from '@/lib/homeStructuredData'
import { occupationSeoNameVi, occupationTitleName } from '@/lib/occupationTypes'
import { laterDate } from '@/lib/sitemapDates'

/** Sổ tay sửa SEO 13/11/2026, Việc 3: sitemap theo điều kiện index, tiêu đề tiếng Việt, schema. */

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function occupation(code: string, nameVi: string, questionSet: 'CURATED' | 'GENERAL' = 'GENERAL') {
  return { code, nameDe: `${code} de`, nameEn: `${code} en`, nameVi, workplace: 'bau', aliases: [], questionSet }
}

describe('tên nghề trong tiêu đề', () => {
  it('nghề ưu tiên dùng tên người Việt hay gõ tìm', () => {
    expect(occupationSeoNameVi({ code: 'pflegefachkraft', nameVi: 'Điều dưỡng' })).toBe('điều dưỡng')
    expect(occupationSeoNameVi({ code: 'koch', nameVi: 'Đầu bếp' })).toBe('đầu bếp')
  })

  it('nghề khác: tên danh mục, viết thường chữ đầu', () => {
    expect(occupationSeoNameVi({ code: 'maurer', nameVi: 'Thợ xây' })).toBe('thợ xây')
  })

  it('en/de giữ tên cũ', () => {
    const o = { code: 'koch', nameDe: 'Koch/Köchin', nameEn: 'Cook', nameVi: 'Đầu bếp' }
    expect(occupationTitleName(o, 'en')).toBe('Cook')
    expect(occupationTitleName(o, 'de')).toBe('Koch/Köchin')
  })
})

describe('laterDate', () => {
  it('lấy ngày muộn hơn, bỏ qua null', () => {
    expect(laterDate('2026-11-13', '2026-11-20')).toBe('2026-11-20')
    expect(laterDate('2026-11-13', '2026-10-01')).toBe('2026-11-13')
    expect(laterDate('2026-11-13', null)).toBe('2026-11-13')
  })
})

describe('schema', () => {
  it('WebSite nối Organization qua @id', () => {
    const ld = websiteStructuredData('de')
    expect(ld['@type']).toBe('WebSite')
    expect(ld.inLanguage).toBe('de-DE')
    expect(ld.publisher['@id']).toMatch(/#organization$/)
  })

  it('BreadcrumbList đánh số từ 1, URL tuyệt đối', () => {
    const ld = breadcrumbStructuredData([['Trang chủ', '/'], ['Cẩm nang', '/cam-nang/']])
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2])
    expect(ld.itemListElement[1].item).toMatch(/^https?:\/\/.+\/cam-nang\/$/)
  })
})

describe('sitemap trang nghề', () => {
  it('dựng lúc có request, không dựng sẵn lúc build (build không gọi được backend)', async () => {
    const mod = await import('@/app/sitemap')
    expect(mod.dynamic).toBe('force-dynamic')
  })

  async function sitemapWith(routes: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => url.endsWith(k))
      return key && routes[key] !== undefined
        ? new Response(JSON.stringify(routes[key]), { status: 200 })
        : new Response('{}', { status: 404 })
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    return sitemap()
  }

  it('lấy đúng danh sách được index, mỗi URL có lastmod', async () => {
    const entries = await sitemapWith({
      '/occupations/indexable': [{ code: 'pflegefachkraft', lastModified: '2026-11-20' }, { code: 'koch', lastModified: null }],
    })
    const urls = entries.map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/phong-van/pflegefachkraft/'))).toBe(true)
    expect(entries.every((e) => typeof e.lastModified === 'string' && e.lastModified.length === 10)).toBe(true)
    expect(entries.find((e) => e.url.endsWith('/phong-van/pflegefachkraft/'))?.lastModified).toBe('2026-11-20')
  })

  it('backend cũ chưa có /indexable → lùi về bộ viết tay', async () => {
    const entries = await sitemapWith({
      '/occupations': [occupation('koch', 'Đầu bếp', 'CURATED'), occupation('maurer', 'Thợ xây')],
    })
    const urls = entries.map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/phong-van/koch/'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/phong-van/maurer/'))).toBe(false)
  })
})
