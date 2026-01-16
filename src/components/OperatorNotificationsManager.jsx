'use client'

import { useState, useEffect } from 'react'
import { db } from '../firebaseConfig'
import { getFcmToken } from '../firebaseMessaging'

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { isSupported } from 'firebase/messaging'

export default function OperatorNotificationsManager({ operatorId }) {
  const [isActivating, setIsActivating] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('Pulsa para activar')

  // 🔍 Al cargar, ver si ya hay token PARA ESTE operador (sin query)
  useEffect(() => {
    if (!operatorId) return

    const checkExistingToken = async () => {
      try {
        const supported = await isSupported().catch(() => false)
        if (!supported) {
          setStatusText('Notificaciones no soportadas en este navegador')
          return
        }

        const ref = doc(db, 'operatorPushTokens', operatorId)
        const snap = await getDoc(ref)

        if (snap.exists() && snap.data()?.token) {
          setEnabled(true)
          setStatusText('Notificaciones activadas en este dispositivo')
        } else {
          setEnabled(false)
          setStatusText('Pulsa para activar')
        }
      } catch (err) {
        console.error('Error comprobando token existente:', err)
        setStatusText('No se pudo comprobar el estado de notificaciones')
      }
    }

    checkExistingToken()
  }, [operatorId])

  const handleActivate = async () => {
    setError('')
    setIsActivating(true)
    setStatusText('Activando…')

    try {
      if (!operatorId) throw new Error('No hay operatorId disponible')

      const supported = await isSupported().catch(() => false)
      if (!supported) throw new Error('Este navegador no soporta notificaciones push')

      if (!('Notification' in window)) {
        throw new Error('Notificaciones no disponibles en este navegador')
      }

      // 1️⃣ Pedir permiso
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Permiso de notificaciones no concedido')
      }

      // 2️⃣ Obtener token
      const token = await getFcmToken()
      if (!token) throw new Error('No se pudo obtener un token de notificación')

      // 3️⃣ Guardar token en: operatorPushTokens/{operatorId}
      const ref = doc(db, 'operatorPushTokens', operatorId)
      const existing = await getDoc(ref)

      if (existing.exists()) {
        // ya existía → solo actualizar token/updatedAt
        await setDoc(
          ref,
          {
            operatorId,
            token,
            updatedAt: serverTimestamp(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
          { merge: true }
        )
      } else {
        // primera vez → crear con createdAt
        await setDoc(
          ref,
          {
            operatorId,
            token,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
          { merge: true }
        )
      }

      setEnabled(true)
      setStatusText('Notificaciones activadas en este dispositivo ✅')
    } catch (err) {
      console.error('Error activando notificaciones de operador:', err)
      setError(err?.message || 'No se pudo activar las notificaciones.')
      setEnabled(false)
      setStatusText('No se pudieron activar las notificaciones')
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={handleActivate}
        disabled={isActivating}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '999px',
          border: 'none',
          background: enabled
            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
            : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.9rem',
          cursor: isActivating ? 'wait' : 'pointer',
          boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
        }}
      >
        {isActivating
          ? 'Activando…'
          : enabled
          ? 'Notificaciones activadas'
          : 'Activar notificaciones'}
      </button>

      <span style={{ fontSize: '0.8rem', color: '#4b5563' }}>{statusText}</span>

      {error && (
        <div
          style={{
            marginTop: 4,
            padding: '8px 10px',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: '0.8rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
