import { useCallback } from 'react'

import { useAppStore } from '../store/appStore'



export function useSession() {

  const setSession = useAppStore((s) => s.setSession)

  const setParsing = useAppStore((s) => s.setParsing)

  const setParseError = useAppStore((s) => s.setParseError)

  const setValidation = useAppStore((s) => s.setValidation)

  const setValidating = useAppStore((s) => s.setValidating)



  const loadSession = useCallback(async (ptxPath: string) => {

    setParsing(true)

    setParseError('')

    setValidation(null)

    try {

      const result = await window.prism.ptxParse(ptxPath)

      setSession(result)

      if (result.parseErrorMessage) {

        setParseError(result.parseErrorMessage)

      }

      setParsing(false)



      if (result.metadata.hasAlignment && result.metadata.tracks.length > 0) {

        setValidating(true)

        try {

          const validation = await window.prism.exportValidate(result.metadata.sessionPath)

          setValidation(validation)

        } catch (err) {

          const message = err instanceof Error ? err.message : String(err)

          setParseError(message)

          setValidating(false)

        }

      }

    } catch (err) {

      const message = err instanceof Error ? err.message : String(err)

      setParseError(message)

      setParsing(false)

      setValidating(false)

    }

  }, [setParseError, setParsing, setSession, setValidating, setValidation])



  const browseSession = useCallback(async () => {

    const path = await window.prism.openPtxFile()

    if (path) await loadSession(path)

  }, [loadSession])



  return { loadSession, browseSession }

}

