import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [masterPasswordSet, setMasterPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('token').then((t) => {
      setToken(t);
      setLoading(false);
    });
  }, []);

  async function signup(email, password) {
    const data = await api.signup(email, password);
    await AsyncStorage.setItem('token', data.token);
    setToken(data.token);
    setMasterPasswordSet(data.masterPasswordSet);
    return data;
  }

  async function login(email, password) {
    const data = await api.login(email, password);
    await AsyncStorage.setItem('token', data.token);
    setToken(data.token);
    setMasterPasswordSet(data.masterPasswordSet);
    return data;
  }

  async function logout() {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setMasterPasswordSet(false);
  }

  return (
    <AuthContext.Provider
      value={{ token, masterPasswordSet, setMasterPasswordSet, loading, signup, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
