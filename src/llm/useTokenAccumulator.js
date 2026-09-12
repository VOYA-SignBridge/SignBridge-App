import { useRef, useCallback, useEffect } from 'react'

const TIMEOUT_MS = 2500  // 2.5s không có token mới → coi là hết câu

export function useTokenAccumulator(onSentenceComplete) {
    const tokensRef = useRef([])
    const timerRef = useRef(null)

    const push = useCallback((token) => {
        if (!token || !token.trim()) return

        clearTimeout(timerRef.current)
        tokensRef.current.push(token)

        timerRef.current = setTimeout(() => {
            if (tokensRef.current.length > 0) {
                onSentenceComplete([...tokensRef.current])
                tokensRef.current = []
            }
        }, TIMEOUT_MS)
    }, [onSentenceComplete])

    const flush = useCallback(() => {
        clearTimeout(timerRef.current)
        if (tokensRef.current.length > 0) {
            onSentenceComplete([...tokensRef.current])
            tokensRef.current = []
        }
    }, [onSentenceComplete])

    const clear = useCallback(() => {
        clearTimeout(timerRef.current)
        tokensRef.current = []
    }, [])

    useEffect(() => () => clearTimeout(timerRef.current), [])

    return { push, flush, clear }
}
