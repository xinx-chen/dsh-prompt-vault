window.__ModuleLoader__.load({
  id: 'dsh-prompt-vault',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'prompt-vault'
    const ID = 'prompt-vault'
    const API = '/prompt-vault'

    /** Most specific language wins; unknown ids fall back to Chinese. */
    const DICT = {
      zh: {
        'panel.label': '提示词库',
        'page.title': '提示词库',
        'page.subtitle': '共 {count} 条 · {tags} 个标签 · 只存在这台机器',
        'action.new': '新建提示词',
        'action.refresh': '刷新',
        'action.retry': '重试',
        'search.placeholder': '搜索标题、正文、备注或标签…',
        'filter.all': '全部',
        'filter.favorite': '★ 常用',
        'empty.title': '还没有收藏提示词',
        'empty.body': '点「新建提示词」手工添加，或直接对我说：把刚才那段提示词收藏起来。',
        'empty.action': '新建第一条',
        'nomatch.title': '没有匹配的提示词',
        'nomatch.body': '换个关键词，或点「全部」清除筛选。',
        'loading': '正在读取提示词库…',
        'editor.new': '新建提示词',
        'editor.edit': '编辑提示词',
        'editor.back': '返回列表',
        'field.title': '标题',
        'field.titlePlaceholder': '写成能力名，如「需求澄清六问」',
        'field.content': '提示词正文',
        'field.contentPlaceholder': '把整段提示词粘进来，【】占位符保留',
        'field.tags': '标签',
        'field.tagsPlaceholder': '用逗号分隔，如：复盘，决策',
        'field.note': '备注',
        'field.notePlaceholder': '一句话：什么时候用它',
        'field.favorite': '标为常用',
        'action.save': '保存',
        'action.saving': '保存中…',
        'action.cancel': '取消',
        'action.copy': '复制',
        'action.edit': '编辑',
        'action.delete': '删除',
        'action.expand': '展开全文',
        'action.collapse': '收起',
        'toast.copied': '已复制到剪贴板',
        'toast.saved': '已保存',
        'toast.deleted': '已删除',
        'toast.favorite': '已更新常用标记',
        'toast.copyFailed': '复制失败，请手动选中文本复制',
        'error.title': '读取失败',
        'error.required': '标题和正文都不能为空',
        'error.titleOnly': '标题不能为空',
        'error.contentOnly': '正文不能为空',
        'confirm.delete': '删除「{title}」？此操作不可撤销。',
        'meta.uses': '用过 {count} 次',
        'meta.updated': '更新于 {date}',
        'meta.source': '来源：{source}',
        'count.summary': '共 {count} 条 · {tags} 个标签',
      },
      en: {
        'panel.label': 'Prompt Vault',
        'page.title': 'Prompt Vault',
        'page.subtitle': '{count} prompts · {tags} tags · stored on this machine',
        'action.new': 'New prompt',
        'action.refresh': 'Refresh',
        'action.retry': 'Retry',
        'search.placeholder': 'Search title, body, note, or tags…',
        'filter.all': 'All',
        'filter.favorite': '★ Favorites',
        'empty.title': 'No prompts saved yet',
        'empty.body': 'Use “New prompt”, or just tell me: save that last prompt to my vault.',
        'empty.action': 'Create the first one',
        'nomatch.title': 'No matching prompts',
        'nomatch.body': 'Try another keyword, or clear the filter with “All”.',
        'loading': 'Reading the vault…',
        'editor.new': 'New prompt',
        'editor.edit': 'Edit prompt',
        'editor.back': 'Back to list',
        'field.title': 'Title',
        'field.titlePlaceholder': 'Name the skill, e.g. “Six clarifying questions”',
        'field.content': 'Prompt',
        'field.contentPlaceholder': 'Paste the whole prompt here; keep the 【】 placeholders',
        'field.tags': 'Tags',
        'field.tagsPlaceholder': 'Comma separated, e.g. review, decision',
        'field.note': 'Note',
        'field.notePlaceholder': 'One line: when to use it',
        'field.favorite': 'Mark as favorite',
        'action.save': 'Save',
        'action.saving': 'Saving…',
        'action.cancel': 'Cancel',
        'action.copy': 'Copy',
        'action.edit': 'Edit',
        'action.delete': 'Delete',
        'action.expand': 'Show all',
        'action.collapse': 'Collapse',
        'toast.copied': 'Copied to clipboard',
        'toast.saved': 'Saved',
        'toast.deleted': 'Deleted',
        'toast.favorite': 'Favorite updated',
        'toast.copyFailed': 'Could not copy; select the text and copy manually',
        'error.title': 'Could not load the vault',
        'error.required': 'Title and prompt body are required',
        'error.titleOnly': 'Title is required',
        'error.contentOnly': 'Prompt body is required',
        'confirm.delete': 'Delete “{title}”? This cannot be undone.',
        'meta.uses': 'Used {count} times',
        'meta.updated': 'Updated {date}',
        'meta.source': 'Source: {source}',
        'count.summary': '{count} prompts · {tags} tags',
      },
    }

    let clientCtx = null
    let boundTranslate = null

    /** Active language from the Client locale service. */
    function activeLang() {
      try {
        const snapshot = clientCtx?.get?.('locale')?.getLocale?.()
        const active = typeof snapshot === 'string' ? snapshot : snapshot?.active
        if (typeof active === 'string' && active.toLowerCase().startsWith('en')) return 'en'
      } catch {
        // A missing locale service still leaves the Chinese dictionary usable.
      }
      return 'zh'
    }

    /** Translate one key, with optional {name} interpolation. */
    function t(key, vars) {
      let value
      if (boundTranslate !== null) {
        try {
          const candidate = boundTranslate(key)
          if (typeof candidate === 'string' && candidate !== '' && candidate !== key) value = candidate
        } catch {
          // Fall through to the bundled dictionary.
        }
      }
      if (value === undefined) {
        const dict = DICT[activeLang()] ?? DICT.zh
        value = dict[key] ?? DICT.zh[key] ?? key
      }
      if (vars !== undefined) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(replacement))
        }
      }
      return value
    }

    /** Re-render when the language or a dictionary changes. */
    function useLocaleRevision() {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const locale = clientCtx?.get?.('locale')
        if (locale === null || locale === undefined || typeof locale.subscribe !== 'function') {
          return undefined
        }
        return locale.subscribe(() => force((n) => n + 1))
      }, [])
    }

    /** Parse a comma/space separated tag string. */
    function parseTags(value) {
      return [...new Set(
        String(value ?? '')
          .split(/[,，、\s]+/)
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ''),
      )].slice(0, 16)
    }

    /** One locale-aware date. */
    function formatDay(timestamp) {
      if (!Number.isFinite(timestamp)) return ''
      try {
        return new Date(timestamp).toLocaleDateString(activeLang() === 'en' ? 'en' : 'zh-CN')
      } catch {
        return ''
      }
    }

    /** Clipboard write with a legacy fallback for locked-down webviews. */
    async function writeClipboard(text) {
      if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text)
        return
      }
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', 'true')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      if (!ok) throw new Error('copy failed')
    }

    /** Sidebar glyph: a bookmark with a small plus. */
    function PromptVaultIcon(props) {
      const size = Number.isFinite(props?.size) ? props.size : 20
      const active = props?.active === true
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: active ? 2 : 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M6.2 3.9h11.6a1.2 1.2 0 0 1 1.2 1.2v15.2l-7-4.2-7 4.2V5.1a1.2 1.2 0 0 1 1.2-1.2Z',
          fill: active ? 'currentColor' : 'none',
          fillOpacity: active ? 0.16 : 0,
        }),
        h('path', { d: 'M12 7.4v4.6M9.7 9.7h4.6' }),
      )
    }

    const CSS = `
.pv-root {
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 28px 32px 72px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.pv-inner { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.pv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.pv-title { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; }
.pv-sub { margin: 6px 0 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.pv-head-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.pv-btn {
  box-sizing: border-box; appearance: none; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 13px; line-height: 1.5;
  cursor: pointer; transition: background .15s, border-color .15s, color .15s;
}
.pv-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.pv-btn:disabled { opacity: .55; cursor: default; }
.pv-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.pv-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.pv-btn-primary:hover { background: var(--dsw-alias-brand-primary); filter: brightness(1.06); }
.pv-btn-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.pv-btn-ghost:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.pv-btn-danger:hover { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); background: transparent; }
.pv-toolbar { display: flex; flex-direction: column; gap: 10px; }
.pv-search {
  box-sizing: border-box; width: 100%; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; outline: none;
}
.pv-search:focus { border-color: var(--dsw-alias-brand-primary); }
.pv-search::placeholder { color: var(--dsw-alias-label-secondary); opacity: .8; }
.pv-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pv-chip {
  box-sizing: border-box; appearance: none; border: 1px solid transparent; background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); border-radius: 999px; padding: 4px 10px;
  font: inherit; font-size: 12px; line-height: 1.4; cursor: pointer;
}
.pv-chip:hover { color: var(--dsw-alias-label-primary); }
.pv-chip[data-active="true"] { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.pv-list { display: flex; flex-direction: column; gap: 12px; }
.pv-card {
  box-sizing: border-box; display: flex; flex-direction: column; gap: 10px;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px; padding: 16px 18px;
}
.pv-card:hover { border-color: var(--dsw-alias-border-l2); }
.pv-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.pv-card-title {
  all: unset; box-sizing: border-box; cursor: pointer; font-size: 15px; font-weight: 600;
  line-height: 1.45; color: var(--dsw-alias-label-primary); word-break: break-word;
}
.pv-card-title:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; border-radius: 4px; }
.pv-star {
  all: unset; flex-shrink: 0; cursor: pointer; color: var(--dsw-alias-label-secondary);
  font-size: 17px; line-height: 1; padding: 2px 4px; border-radius: 6px;
}
.pv-star:hover { color: var(--dsw-alias-state-warn-primary); }
.pv-star[data-on="true"] { color: var(--dsw-alias-state-warn-primary); }
.pv-star:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.pv-tagline { display: flex; flex-wrap: wrap; gap: 6px; }
.pv-tag {
  box-sizing: border-box; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  border-radius: 6px; padding: 2px 7px; font-size: 11.5px; line-height: 1.5;
}
.pv-content {
  margin: 0; font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
}
.pv-content[data-open="true"] { display: block; -webkit-line-clamp: unset; overflow: visible; }
.pv-card-foot {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px;
}
.pv-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.pv-sep { opacity: .5; }
.pv-foot-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.pv-foot-actions .pv-btn { padding: 4px 8px; font-size: 12px; }
.pv-empty {
  box-sizing: border-box; display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 8px; padding: 64px 24px; border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 14px; color: var(--dsw-alias-label-secondary);
}
.pv-empty-title { margin: 8px 0 0; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pv-empty-body { margin: 0; font-size: 13px; line-height: 1.7; max-width: 420px; }
.pv-empty .pv-btn { margin-top: 10px; }
.pv-status { padding: 48px 0; text-align: center; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.pv-error {
  box-sizing: border-box; border: 1px solid var(--dsw-alias-state-error-primary);
  border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.6;
  color: var(--dsw-alias-state-error-primary);
}
.pv-error-actions { margin-top: 8px; }
.pv-editor {
  box-sizing: border-box; background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
}
.pv-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pv-editor-title { margin: 0; font-size: 17px; font-weight: 650; }
.pv-form { display: flex; flex-direction: column; gap: 14px; }
.pv-field { display: flex; flex-direction: column; gap: 6px; }
.pv-label { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.pv-input, .pv-textarea {
  box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 1.6; outline: none;
}
.pv-input:focus, .pv-textarea:focus { border-color: var(--dsw-alias-brand-primary); }
.pv-input::placeholder, .pv-textarea::placeholder { color: var(--dsw-alias-label-secondary); opacity: .75; }
.pv-textarea { min-height: 190px; resize: vertical; }
.pv-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.pv-check input { accent-color: var(--dsw-alias-brand-primary); }
.pv-form-error { font-size: 13px; line-height: 1.6; color: var(--dsw-alias-state-error-primary); }
.pv-editor-foot { display: flex; justify-content: flex-end; gap: 8px; }
.pv-toast {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 8px 16px; font-size: 13px; line-height: 1.5;
  color: var(--dsw-alias-label-primary); z-index: 50; pointer-events: none;
}
@media (max-width: 720px) {
  .pv-root { padding: 20px 16px 64px; }
  .pv-head { flex-direction: column; align-items: stretch; }
  .pv-head-actions { justify-content: flex-end; }
}
`

    function EmptyState(props) {
      return h('div', { className: 'pv-empty' },
        h('svg', {
          width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        },
          h('path', { d: 'M6.2 3.9h11.6a1.2 1.2 0 0 1 1.2 1.2v15.2l-7-4.2-7 4.2V5.1a1.2 1.2 0 0 1 1.2-1.2Z' }),
          h('path', { d: 'M12 7.4v4.6M9.7 9.7h4.6' }),
        ),
        h('p', { className: 'pv-empty-title' }, props.title),
        h('p', { className: 'pv-empty-body' }, props.body),
        props.actionLabel !== undefined
          ? h('button', { type: 'button', className: 'pv-btn pv-btn-primary', onClick: props.onAction }, props.actionLabel)
          : null,
      )
    }

    function PromptVaultPage() {
      useLocaleRevision()
      const [state, setState] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [loadError, setLoadError] = React.useState('')
      const [query, setQuery] = React.useState('')
      const [tag, setTag] = React.useState('')
      const [favoriteOnly, setFavoriteOnly] = React.useState(false)
      const [expandedId, setExpandedId] = React.useState('')
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [formError, setFormError] = React.useState('')
      const [toast, setToast] = React.useState('')
      const toastTimer = React.useRef(null)

      const notify = React.useCallback((message) => {
        setToast(message)
        if (toastTimer.current !== null) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 2200)
      }, [])

      React.useEffect(() => () => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current)
      }, [])

      const load = React.useCallback(async () => {
        setLoading(true)
        setLoadError('')
        try {
          const res = await fetch(`${API}/state`, { credentials: 'same-origin', cache: 'no-store' })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
          setState(data)
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : String(error))
        } finally {
          setLoading(false)
        }
      }, [])

      React.useEffect(() => {
        load()
      }, [load])

      React.useEffect(() => {
        const onVisible = () => {
          if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
      }, [load])

      const mutate = React.useCallback(async (action, payload) => {
        const res = await fetch(`${API}/action`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        setState(data)
        return data
      }, [])

      const closeEditor = React.useCallback(() => {
        setEditing(false)
        setDraft(null)
        setFormError('')
      }, [])

      React.useEffect(() => {
        if (!editing) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape' && !saving) closeEditor()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [editing, saving, closeEditor])

      const startAdd = () => {
        setDraft({ id: '', title: '', content: '', tags: '', note: '', favorite: false })
        setFormError('')
        setEditing(true)
      }

      const startEdit = (prompt) => {
        setDraft({
          id: prompt.id,
          title: prompt.title,
          content: prompt.content,
          tags: prompt.tags.join('，'),
          note: prompt.note,
          favorite: prompt.favorite,
        })
        setFormError('')
        setEditing(true)
      }

      const save = async (event) => {
        if (event !== undefined) event.preventDefault()
        if (draft === null || saving) return
        const title = draft.title.trim()
        const content = draft.content.trim()
        if (title === '' || content === '') {
          setFormError(t('error.required'))
          return
        }
        setSaving(true)
        setFormError('')
        const payload = {
          title,
          content,
          tags: parseTags(draft.tags),
          note: draft.note.trim(),
          favorite: draft.favorite,
        }
        try {
          if (draft.id !== '') {
            await mutate('update', { id: draft.id, ...payload })
          } else {
            await mutate('add', payload)
          }
          closeEditor()
          notify(t('toast.saved'))
        } catch (error) {
          setFormError(error instanceof Error ? error.message : String(error))
        } finally {
          setSaving(false)
        }
      }

      const toggleFavorite = async (prompt) => {
        try {
          await mutate('favorite', { id: prompt.id, favorite: !prompt.favorite })
          notify(t('toast.favorite'))
        } catch (error) {
          notify(error instanceof Error ? error.message : String(error))
        }
      }

      const remove = async (prompt) => {
        const ok = window.confirm(t('confirm.delete', { title: prompt.title }))
        if (!ok) return
        try {
          await mutate('delete', { id: prompt.id })
          if (expandedId === prompt.id) setExpandedId('')
          notify(t('toast.deleted'))
        } catch (error) {
          notify(error instanceof Error ? error.message : String(error))
        }
      }

      const copy = async (prompt) => {
        try {
          await writeClipboard(prompt.content)
          notify(t('toast.copied'))
          mutate('use', { id: prompt.id }).catch(() => {})
        } catch {
          notify(t('toast.copyFailed'))
        }
      }

      if (editing && draft !== null) {
        return h('div', { className: 'pv-root' },
          h('style', null, CSS),
          h('div', { className: 'pv-inner' },
            h('div', { className: 'pv-editor' },
              h('div', { className: 'pv-editor-head' },
                h('h1', { className: 'pv-editor-title' }, draft.id === '' ? t('editor.new') : t('editor.edit')),
                h('button', { type: 'button', className: 'pv-btn pv-btn-ghost', onClick: closeEditor, disabled: saving }, t('editor.back')),
              ),
              h('form', { className: 'pv-form', onSubmit: save },
                h('label', { className: 'pv-field' },
                  h('span', { className: 'pv-label' }, t('field.title')),
                  h('input', {
                    className: 'pv-input', type: 'text', value: draft.title, maxLength: 120, autoFocus: true,
                    placeholder: t('field.titlePlaceholder'),
                    onChange: (event) => setDraft({ ...draft, title: event.target.value }),
                  }),
                ),
                h('label', { className: 'pv-field' },
                  h('span', { className: 'pv-label' }, t('field.content')),
                  h('textarea', {
                    className: 'pv-textarea', value: draft.content, maxLength: 20000, rows: 10,
                    placeholder: t('field.contentPlaceholder'),
                    onChange: (event) => setDraft({ ...draft, content: event.target.value }),
                  }),
                ),
                h('label', { className: 'pv-field' },
                  h('span', { className: 'pv-label' }, t('field.tags')),
                  h('input', {
                    className: 'pv-input', type: 'text', value: draft.tags,
                    placeholder: t('field.tagsPlaceholder'),
                    onChange: (event) => setDraft({ ...draft, tags: event.target.value }),
                  }),
                ),
                h('label', { className: 'pv-field' },
                  h('span', { className: 'pv-label' }, t('field.note')),
                  h('textarea', {
                    className: 'pv-textarea', value: draft.note, maxLength: 4000, rows: 2,
                    style: { minHeight: 60 },
                    placeholder: t('field.notePlaceholder'),
                    onChange: (event) => setDraft({ ...draft, note: event.target.value }),
                  }),
                ),
                h('label', { className: 'pv-check' },
                  h('input', {
                    type: 'checkbox', checked: draft.favorite,
                    onChange: (event) => setDraft({ ...draft, favorite: event.target.checked }),
                  }),
                  t('field.favorite'),
                ),
                formError !== '' ? h('div', { className: 'pv-form-error' }, formError) : null,
                h('div', { className: 'pv-editor-foot' },
                  h('button', { type: 'button', className: 'pv-btn', onClick: closeEditor, disabled: saving }, t('action.cancel')),
                  h('button', { type: 'submit', className: 'pv-btn pv-btn-primary', disabled: saving }, saving ? t('action.saving') : t('action.save')),
                ),
              ),
            ),
          ),
        )
      }

      const prompts = state?.prompts ?? []
      const tags = state?.tags ?? []
      const needle = query.trim().toLocaleLowerCase()
      const visible = prompts.filter((prompt) => {
        if (favoriteOnly && !prompt.favorite) return false
        if (tag !== '' && !prompt.tags.includes(tag)) return false
        if (needle === '') return true
        return `${prompt.title}\n${prompt.content}\n${prompt.note}\n${prompt.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(needle)
      })
      const filtering = needle !== '' || tag !== '' || favoriteOnly

      return h('div', { className: 'pv-root' },
        h('style', null, CSS),
        h('div', { className: 'pv-inner' },
          h('header', { className: 'pv-head' },
            h('div', null,
              h('h1', { className: 'pv-title' }, t('page.title')),
              h('p', { className: 'pv-sub' }, t('page.subtitle', { count: prompts.length, tags: tags.length })),
            ),
            h('div', { className: 'pv-head-actions' },
              h('button', { type: 'button', className: 'pv-btn pv-btn-ghost', onClick: load, disabled: loading }, t('action.refresh')),
              h('button', { type: 'button', className: 'pv-btn pv-btn-primary', onClick: startAdd }, t('action.new')),
            ),
          ),

          loadError !== ''
            ? h('div', { className: 'pv-error' },
                h('div', null, `${t('error.title')}：${loadError}`),
                h('div', { className: 'pv-error-actions' },
                  h('button', { type: 'button', className: 'pv-btn', onClick: load }, t('action.retry')),
                ),
              )
            : null,

          loading && state === null ? h('div', { className: 'pv-status' }, t('loading')) : null,

          state !== null
            ? h('div', { className: 'pv-toolbar' },
                h('input', {
                  className: 'pv-search', type: 'search', value: query,
                  placeholder: t('search.placeholder'),
                  'aria-label': t('search.placeholder'),
                  onChange: (event) => setQuery(event.target.value),
                }),
                h('div', { className: 'pv-chips' },
                  h('button', {
                    type: 'button', className: 'pv-chip', 'data-active': String(!favoriteOnly && tag === ''),
                    onClick: () => { setFavoriteOnly(false); setTag('') },
                  }, t('filter.all')),
                  h('button', {
                    type: 'button', className: 'pv-chip', 'data-active': String(favoriteOnly),
                    onClick: () => { setFavoriteOnly(!favoriteOnly); setTag('') },
                  }, t('filter.favorite')),
                  tags.map((entry) => h('button', {
                    key: entry.tag,
                    type: 'button',
                    className: 'pv-chip',
                    'data-active': String(!favoriteOnly && tag === entry.tag),
                    onClick: () => { setFavoriteOnly(false); setTag(tag === entry.tag ? '' : entry.tag) },
                  }, `${entry.tag} ${entry.count}`)),
                ),
              )
            : null,

          state !== null && prompts.length === 0
            ? h(EmptyState, {
                title: t('empty.title'),
                body: t('empty.body'),
                actionLabel: t('empty.action'),
                onAction: startAdd,
              })
            : null,

          state !== null && prompts.length > 0 && visible.length === 0
            ? h(EmptyState, { title: t('nomatch.title'), body: t('nomatch.body') })
            : null,

          state !== null && visible.length > 0
            ? h('div', { className: 'pv-list' },
                visible.map((prompt) => {
                  const open = expandedId === prompt.id
                  return h('article', { key: prompt.id, className: 'pv-card' },
                    h('div', { className: 'pv-card-head' },
                      h('button', {
                        type: 'button',
                        className: 'pv-card-title',
                        title: open ? t('action.collapse') : t('action.expand'),
                        onClick: () => setExpandedId(open ? '' : prompt.id),
                      }, prompt.title),
                      h('button', {
                        type: 'button',
                        className: 'pv-star',
                        'data-on': String(prompt.favorite),
                        'aria-label': t('field.favorite'),
                        'aria-pressed': prompt.favorite,
                        title: t('field.favorite'),
                        onClick: () => toggleFavorite(prompt),
                      }, prompt.favorite ? '★' : '☆'),
                    ),
                    prompt.tags.length > 0
                      ? h('div', { className: 'pv-tagline' },
                          prompt.tags.map((item) => h('span', { key: item, className: 'pv-tag' }, item)),
                        )
                      : null,
                    h('p', { className: 'pv-content', 'data-open': String(open) }, prompt.content),
                    h('div', { className: 'pv-card-foot' },
                      h('div', { className: 'pv-meta' },
                        h('span', null, t('meta.updated', { date: formatDay(prompt.updatedAt) })),
                        prompt.uses > 0 ? h('span', null, t('meta.uses', { count: prompt.uses })) : null,
                        prompt.source !== '' && prompt.source !== '手工' && prompt.source !== 'manual'
                          ? h('span', null, t('meta.source', { source: prompt.source }))
                          : null,
                      ),
                      h('div', { className: 'pv-foot-actions' },
                        h('button', { type: 'button', className: 'pv-btn', onClick: () => copy(prompt) }, t('action.copy')),
                        h('button', { type: 'button', className: 'pv-btn pv-btn-ghost', onClick: () => startEdit(prompt) }, t('action.edit')),
                        h('button', { type: 'button', className: 'pv-btn pv-btn-ghost pv-btn-danger', onClick: () => remove(prompt) }, t('action.delete')),
                      ),
                    ),
                  )
                }),
              )
            : null,
        ),
        toast !== '' ? h('div', { className: 'pv-toast', role: 'status' }, toast) : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        clientCtx = ctx

        const locale = ctx.get('locale')
        if (locale !== null && locale !== undefined && typeof locale.register === 'function') {
          try {
            ctx.effect(() => locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'prompt-vault: dictionaries')
            if (typeof locale.bind === 'function') boundTranslate = locale.bind(NS)
          } catch (error) {
            console.warn('[prompt-vault] dictionaries unavailable, using bundled text', error)
          }
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: ID,
          order: 25,
          label: () => t('panel.label'),
        }, PromptVaultIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: ID,
        }, PromptVaultPage))
      },
    }
  },
})
