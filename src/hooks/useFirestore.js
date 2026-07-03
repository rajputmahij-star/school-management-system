import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

/**
 * Generic hook for fetching Firestore data
 * @param {Function} fetchFn - async function that returns data
 * @param {Array} deps - dependency array to re-trigger fetch
 * @param {Object} options - { showError: bool, errorMsg: string }
 */
export function useFirestore(fetchFn, deps = [], options = {}) {
  const { showError = true, errorMsg = 'Failed to load data' } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      setData(result)
    } catch (err) {
      setError(err)
      if (showError) toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * Hook for CRUD operations with loading state per operation
 */
export function useCrud() {
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async (fn, successMsg = 'Saved successfully') => {
    setSaving(true)
    try {
      await fn()
      toast.success(successMsg)
      return true
    } catch (err) {
      toast.error(err.message || 'Operation failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const remove = async (fn, successMsg = 'Deleted successfully') => {
    setDeleting(true)
    try {
      await fn()
      toast.success(successMsg)
      return true
    } catch (err) {
      toast.error(err.message || 'Delete failed')
      return false
    } finally {
      setDeleting(false)
    }
  }

  return { saving, deleting, save, remove }
}
