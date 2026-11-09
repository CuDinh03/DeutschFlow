import { describe, expect, it, vi } from 'vitest'
import type { CaptureResult, PostHog } from 'posthog-js'
import {
  posthogPrivacyConfig,
  scrubCapturedNetworkRequest,
  scrubPostHogEvent,
  scrubStoredPersonInfo,
} from './posthogPrivacy'

const TOKEN_URL = 'https://mydeutschflow.com/v2/activate?token=SECRET1&utm_source=mail'
const PATH_URL = 'https://mydeutschflow.com/certificate/SECRET2'

function event(over: Partial<CaptureResult> = {}): CaptureResult {
  return { uuid: 'u1', event: '$autocapture', properties: {}, ...over }
}

describe('scrubPostHogEvent (before_send)', () => {
  it('lọc mọi thuộc tính URL posthog-js tự gắn, trên mọi loại sự kiện', () => {
    for (const name of ['$pageview', '$pageleave', '$autocapture', '$rageclick', '$web_vitals', 'app_opened']) {
      const out = scrubPostHogEvent(event({
        event: name,
        properties: {
          $current_url: TOKEN_URL,
          $referrer: PATH_URL,
          $pathname: '/certificate/SECRET2',
          $prev_pageview_pathname: '/phieu/SECRET3',
          $prev_pageview_url: 'https://x.com/report/SECRET4',
          $session_entry_url: TOKEN_URL,
          $session_entry_referrer: PATH_URL,
          $session_entry_pathname: '/report/SECRET4',
          $external_click_url: 'https://other.com/?token=SECRET5',
          path: '/certificate/SECRET2',
          referrer: TOKEN_URL,
          $referring_domain: 'mydeutschflow.com',
          $browser: 'Chrome',
        },
      }))!
      const json = JSON.stringify(out)
      expect(json).not.toMatch(/SECRET/)
      expect(out.properties.$current_url).toBe('https://mydeutschflow.com/v2/activate?utm_source=mail')
      expect(out.properties.$pathname).toBe('/certificate/:token')
      expect(out.properties.$referring_domain).toBe('mydeutschflow.com')
      expect(out.properties.$browser).toBe('Chrome')
    }
  })

  it('lọc thuộc tính người dùng $set / $set_once ($initial_current_url, $initial_referrer…)', () => {
    const out = scrubPostHogEvent(event({
      event: '$identify',
      $set: { $current_url: TOKEN_URL },
      $set_once: {
        $initial_current_url: TOKEN_URL,
        $initial_referrer: PATH_URL,
        $initial_pathname: '/phieu/SECRET3',
        $initial_utm_source: 'mail',
      },
    }))!
    expect(JSON.stringify(out)).not.toMatch(/SECRET/)
    expect(out.$set_once?.$initial_utm_source).toBe('mail')
  })

  it('lọc href/chữ của phần tử autocapture, $elements_chain và heatmap', () => {
    const out = scrubPostHogEvent(event({
      properties: {
        $elements_chain: 'a:attr__href="/certificate/SECRET2"href="/v2/activate?token=SECRET1"nth-child="1"',
        $el_text: 'https://x.com/phieu/SECRET3',
        $elements: [{ tag_name: 'a', attr__href: '/report/SECRET4', $el_text: '/certificate/SECRET2' }],
        $heatmap_data: { [TOKEN_URL]: [{ x: 1 }], 'https://mydeutschflow.com/v2/activate?token=OTHER': [{ x: 2 }] },
      },
    }))!
    expect(JSON.stringify(out)).not.toMatch(/SECRET|OTHER/)
    expect(out.properties.$heatmap_data).toEqual({
      'https://mydeutschflow.com/v2/activate?utm_source=mail': [{ x: 1 }],
      'https://mydeutschflow.com/v2/activate': [{ x: 2 }],
    })
  })

  it('lọc URL lồng trong đối tượng ($web_vitals_*_event) và href trong $snapshot', () => {
    const when = new Date('2026-11-09T00:00:00Z')
    const out = scrubPostHogEvent(event({
      event: '$snapshot',
      properties: {
        $web_vitals_LCP_event: { value: 1, $current_url: TOKEN_URL },
        $event_time_override_system_time: when,
        $snapshot_data: [
          { type: 4, data: { href: PATH_URL, width: 1 } },
          { type: 5, data: { tag: '$url_changed', payload: { href: TOKEN_URL } } },
          { type: 3, data: { source: 0 } },
        ],
      },
    }))!
    expect(JSON.stringify(out)).not.toMatch(/SECRET/)
    expect(out.properties.$event_time_override_system_time).toBe(when)
    expect(out.properties.$snapshot_data[2]).toEqual({ type: 3, data: { source: 0 } })
  })

  it('null (sự kiện đã bị bỏ ở bước trước) đi qua nguyên', () => {
    expect(scrubPostHogEvent(null)).toBeNull()
  })
})

const req = (name: string) => ({ name, duration: 1, entryType: 'resource', startTime: 0 })

describe('scrubCapturedNetworkRequest (bản ghi phiên)', () => {
  it('lọc URL request mạng và href trang', () => {
    expect(scrubCapturedNetworkRequest(req('https://api.x.com/api/auth/activate?token=SECRET1')).name).toBe(
      'https://api.x.com/api/auth/activate',
    )
    expect(scrubCapturedNetworkRequest(req('/api/public/org-invitations/SECRET6')).name).toBe(
      '/api/public/org-invitations/:token',
    )
  })
})

describe('scrubStoredPersonInfo', () => {
  it('lọc URL lần đầu đã lưu (gửi kèm mỗi lần hỏi feature flag, không qua before_send)', () => {
    const register = vi.fn()
    const ph = { persistence: { props: { $initial_person_info: { u: TOKEN_URL, r: PATH_URL } }, register } }
    scrubStoredPersonInfo(ph as unknown as PostHog)
    expect(register).toHaveBeenCalledWith({
      $initial_person_info: {
        u: 'https://mydeutschflow.com/v2/activate?utm_source=mail',
        r: 'https://mydeutschflow.com/certificate/:token',
      },
    })
  })

  it('không ghi lại khi đã sạch; không ném khi thiếu persistence', () => {
    const register = vi.fn()
    scrubStoredPersonInfo({ persistence: { props: { $initial_person_info: { u: '/v2', r: '$direct' } }, register } } as unknown as PostHog)
    expect(register).not.toHaveBeenCalled()
    expect(() => scrubStoredPersonInfo({} as PostHog)).not.toThrow()
  })
})

describe('posthogPrivacyConfig', () => {
  it('bật che tại nguồn cho các query bí mật và gắn before_send', () => {
    const cfg = posthogPrivacyConfig({} as PostHog)
    expect(cfg.mask_personal_data_properties).toBe(true)
    expect(cfg.custom_personal_data_properties).toEqual(expect.arrayContaining(['token', 'code']))
    const out = cfg.before_send(event({ properties: { $current_url: TOKEN_URL } }))
    expect(out?.properties.$current_url).not.toContain('SECRET')
  })
})
