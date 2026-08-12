import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { setUnauthorizedHandler } from '../api'

const AuthContext = createContext(null)

// NOTE ON TOKEN STORAGE: the JWT is kept in sessionStorage so a page
// refresh doesn't force a re-login, and it's cleared automatically when
// the tab closes. sessionStorage is readable by any JS on the page, so
// it's only as safe as the app is free of XSS — for a production
// deployment, prefer an httpOnly, Secure, SameSite=strict cookie instead
// and move token issuance server-side accordingly.

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => sessionStorage.getItem('vault_username'))
  const [ready, setReady] = useState(true)

  const logout = useCallback(() => {
    sessionStorage.removeItem('vault_token')
    sessionStorage.removeItem('vault_username')
    setUsername(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => logout())
  }, [logout])

  const login = async (username, password) => {
    const { data } = await api.post('/login', { username, password })
    sessionStorage.setItem('vault_token', data.access_token)
    sessionStorage.setItem('vault_username', data.username)
    setUsername(data.username)
  }

  const register = async (username, password) => {
    const { data } = await api.post('/register', { username, password })
    sessionStorage.setItem('vault_token', data.access_token)
    sessionStorage.setItem('vault_username', data.username)
    setUsername(data.username)
  }

  return (
    <AuthContext.Provider value={{ username, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
