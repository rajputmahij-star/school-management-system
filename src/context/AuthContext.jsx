import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, getCurrentUserData, loginUser, logoutUser } from '../firebase/auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const data = await getCurrentUserData(firebaseUser.uid)
          setUser(firebaseUser)
          setUserData(data)
        } catch (err) {
          setError(err.message)
          await logoutUser()
          setUser(null)
          setUserData(null)
        }
      } else {
        setUser(null)
        setUserData(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const firebaseUser = await loginUser(email, password)
      const data = await getCurrentUserData(firebaseUser.uid)
      setUser(firebaseUser)
      setUserData(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const logout = async () => {
    await logoutUser()
    setUser(null)
    setUserData(null)
  }

  const refreshUserData = async () => {
    if (user) {
      const data = await getCurrentUserData(user.uid)
      setUserData(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, error, login, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
