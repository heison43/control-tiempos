'use client';
import { useEffect, useState } from 'react';
import { auth, provider, db } from '../../firebaseConfig';

import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export default function DebugFirebase() {
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFirestore = async () => {
    addLog('🔍 Iniciando test de Firestore...');
    
    try {
      // Test 1: Conexión básica
      addLog('📡 Probando conexión a Firestore...');
      
      // Test 2: Leer documento específico
      addLog('🔎 Buscando usuario heison659@gmail.com...');
      const userDoc = await getDoc(doc(db, 'users', 'heison659@gmail.com'));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        addLog(`✅ USUARIO ENCONTRADO: ${JSON.stringify(data)}`);
      } else {
        addLog('❌ USUARIO NO ENCONTRADO');
        
        // Listar todos los documentos en users
        addLog('📋 Listando todos los usuarios...');
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.forEach((doc) => {
          addLog(`   - ${doc.id} => ${JSON.stringify(doc.data())}`);
        });
      }
    } catch (error) {
      addLog(`💥 ERROR: ${error.message}`);
      addLog(`📝 Código: ${error.code}`);
    }
  };

  const testAuth = async () => {
    addLog('🔑 Probando autenticación...');
    try {
      const result = await signInWithPopup(auth, provider);
      addLog(`✅ Login exitoso: ${result.user.email}`);
      
      // Test Firestore después de login
      await testFirestore();
      
      // Cerrar sesión
      await signOut(auth);
      addLog('🔒 Sesión cerrada');
    } catch (error) {
      addLog(`💥 Error auth: ${error.message}`);
    }
  };

  useEffect(() => {
    addLog('🚀 Debug iniciado');
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Firebase</h1>
      <button 
        onClick={testFirestore}
        style={{ margin: '10px', padding: '10px', background: 'blue', color: 'white' }}
      >
        Test Firestore
      </button>
      <button 
        onClick={testAuth}
        style={{ margin: '10px', padding: '10px', background: 'green', color: 'white' }}
      >
        Test Auth + Firestore
      </button>
      
      <div style={{ marginTop: '20px', background: '#f5f5f5', padding: '10px' }}>
        <h3>Logs:</h3>
        {logs.map((log, index) => (
          <div key={index} style={{ 
            padding: '5px', 
            borderBottom: '1px solid #ddd',
            color: log.includes('❌') || log.includes('💥') ? 'red' : 
                   log.includes('✅') ? 'green' : 'black'
          }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}