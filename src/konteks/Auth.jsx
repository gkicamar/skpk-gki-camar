import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';

const KonteksAuth = createContext(null);
export const useAuth = () => useContext(KonteksAuth);

export function PenyediaAuth({ children }) {
  const [userAuth, setUserAuth] = useState(null);
  const [profil, setProfil] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  // Dengarkan status masuk. Profil dan peran diambil dari koleksi pengguna,
  // bukan dari token, supaya perubahan peran langsung berlaku tanpa masuk ulang.
  useEffect(() => {
    const lepas = onAuthStateChanged(auth, (u) => {
      setUserAuth(u);
      if (!u) { setProfil(null); setMemuat(false); }
    });
    return lepas;
  }, []);

  useEffect(() => {
    if (!userAuth) return;
    setMemuat(true);
    const lepas = onSnapshot(
      doc(db, 'pengguna', userAuth.uid),
      (snap) => {
        setProfil(snap.exists() ? { uid: snap.id, ...snap.data() } : null);
        setMemuat(false);
      },
      () => { setProfil(null); setMemuat(false); }
    );
    return lepas;
  }, [userAuth]);

  const masuk = async (email, sandi) => {
    setGalat('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), sandi);
      return true;
    } catch (e) {
      const pesan = {
        'auth/invalid-credential': 'Email atau kata sandi tidak cocok.',
        'auth/invalid-email': 'Format email tidak sah.',
        'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi super user.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit.',
        'auth/network-request-failed': 'Sambungan gagal. Periksa jaringan.',
      }[e.code] || 'Tidak bisa masuk. Coba lagi.';
      setGalat(pesan);
      return false;
    }
  };

  const keluar = () => signOut(auth);

  // Ganti kata sandi sendiri. Firebase mensyaratkan autentikasi ulang
  // untuk tindakan sensitif, jadi sandi lama tetap diminta.
  const gantiSandi = async (sandiLama, sandiBaru) => {
    if (!auth.currentUser) throw new Error('Belum masuk');
    const kredensial = EmailAuthProvider.credential(auth.currentUser.email, sandiLama);
    await reauthenticateWithCredential(auth.currentUser, kredensial);
    await updatePassword(auth.currentUser, sandiBaru);
    await updateDoc(doc(db, 'pengguna', auth.currentUser.uid), {
      sandiAwal: false,
      diperbarui: serverTimestamp(),
    });
  };

  const nilai = {
    userAuth, profil, memuat, galat, setGalat,
    masuk, keluar, gantiSandi,
    peran: profil?.peran || null,
    bpSaya: profil?.bp || [],
    unitSaya: profil?.unit || [],
    aktif: profil?.aktif === true,
  };

  return <KonteksAuth.Provider value={nilai}>{children}</KonteksAuth.Provider>;
}
