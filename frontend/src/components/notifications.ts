import { apiFetch } from '../auth'
import { navigate } from '../router'

export async function renderNotificationBell(container: HTMLElement, city: string) {
  const res = await apiFetch('/notifications')
  if (!res.ok) return
  const { unread, notifications } = await res.json()

  container.innerHTML = `
    <div class="notif-bell" id="notif-toggle">
      🔔 ${unread > 0 ? `<span class="notif-badge">${unread}</span>` : ''}
    </div>
    <div class="notif-dropdown hidden" id="notif-dropdown">
      ${notifications.length === 0
        ? '<p class="notif-empty">No notifications</p>'
        : notifications.slice(0, 10).map((n: any) => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-issue="${n.issue_number}" data-city="${city}">
            <strong>@${n.actor_username}</strong> commented on post #${n.issue_number}
            <span class="notif-time">${timeAgo(n.created_at)}</span>
          </div>
        `).join('')
      }
      ${notifications.length > 0
        ? '<button id="mark-all-read">Mark all read</button>'
        : ''
      }
    </div>
  `

  container.querySelector('#notif-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation()
    container.querySelector('#notif-dropdown')?.classList.toggle('hidden')
  })

  document.addEventListener('click', () => {
    container.querySelector('#notif-dropdown')?.classList.add('hidden')
  })

  container.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.getAttribute('data-id')!
      const issue = item.getAttribute('data-issue')!
      const c = item.getAttribute('data-city')!
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
      navigate(`/${c}/posts/${issue}`)
    })
  })

  container.querySelector('#mark-all-read')?.addEventListener('click', async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' })
    renderNotificationBell(container, city)
  })
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
