// src/hooks/useFirestoreNewDocsNotification.js
import { useEffect, useRef } from "react";
import { onSnapshot } from "firebase/firestore";
import { showBrowserNotification } from "./useBrowserNotifications";

/**
 * Escucha una query de Firestore y lanza una notificación cuando
 * se agrega un nuevo documento (ignorando la primera carga inicial).
 *
 * @param {import("firebase/firestore").Query} queryRef - query de Firestore
 * @param {(doc) => { title: string, body?: string }} getMessage - función que construye el mensaje
 * @param {boolean} enabled - si está activado el listener
 */
export function useFirestoreNewDocsNotification(queryRef, getMessage, enabled) {
  const isFirstSnapshot = useRef(true);

  useEffect(() => {
    if (!enabled || !queryRef) return;

    // 🔹 IMPORTANTE: resetear cuando cambie la query
    isFirstSnapshot.current = true;

    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
      if (isFirstSnapshot.current) {
        isFirstSnapshot.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const doc = change.doc;
          const msg = getMessage(doc);
          if (msg?.title) {
            showBrowserNotification(msg.title, {
              body: msg.body,
              icon: "/icons/icon-192x192.png",
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [queryRef, enabled, getMessage]); // 👈 añadir getMessage por buenas prácticas
}
