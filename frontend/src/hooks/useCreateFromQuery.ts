import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Open a page's existing "create" form when the URL carries ?new=1,
 * so other pages (e.g. dashboard quick actions) can link straight to it.
 * The parameter is removed afterwards so a refresh does not reopen the form.
 */
export function useCreateFromQuery(openCreate: () => void) {
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    if (params.get('new') !== '1') return
    openCreate()
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
    // openCreate is redefined on every render; only the URL should trigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, setParams])
}
