import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, LogIn, LogOut, User, MapPin, Settings, Upload } from "lucide-react";
import { auth, storage } from "../../firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Importaciones de Storage

// --- RECURSOS HD ---
const EARTH_BASE_HD = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"; 
const EARTH_TOPOLOGY = "//unpkg.com/three-globe/example/img/earth-topology.png";
const CLOUDS_IMG = "//unpkg.com/three-globe/example/img/clouds.png";

// --- COLORES ---
const THEME_COLOR = "#06b6d4"; 
const ATMOSPHERE_COLOR = "#3a9efd";

// Componente para manejar el cambio de perfil
const ProfileModal = ({ user, onClose }) => {
    const [newDisplayName, setNewDisplayName] = useState(user.displayName || "");
    const [newPhotoURL, setNewPhotoURL] = useState(user.photoURL || "");
    const [file, setFile] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const fileInputRef = useRef(null);

    const isDirty = newDisplayName.trim() !== (user.displayName || "") || (newPhotoURL.trim() !== (user.photoURL || "") && !file) || file;
    const currentPhotoPreview = file ? URL.createObjectURL(file) : newPhotoURL;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setNewPhotoURL(''); // Prioriza la subida de archivo sobre la URL
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!isDirty || isUpdating) return;
        
        setIsUpdating(true);
        let finalPhotoURL = newPhotoURL;

        try {
            if (file) {
                // 1. SUBIR ARCHIVO A FIREBASE STORAGE
                const storageRef = ref(storage, `users/${user.uid}/profile_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, file);
                
                // 2. OBTENER URL DE DESCARGA
                finalPhotoURL = await getDownloadURL(snapshot.ref);
            }

            // 3. ACTUALIZAR EL PERFIL DE FIREBASE
            await updateProfile(user, { 
                displayName: newDisplayName.trim(),
                photoURL: finalPhotoURL.trim() || null 
            });
            
            setFile(null);
            alert("Perfil actualizado correctamente.");
            onClose();

        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            alert("Error al actualizar perfil. Asegúrate de que la URL sea válida o el archivo sea una imagen.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-zinc-950/95 border border-cyan-500/20 p-8 w-full max-w-sm relative shadow-[0_0_80px_rgba(6,182,212,0.2)] backdrop-blur-md ring-1 ring-white/5">
                
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-cyan-400 transition-colors hover:drop-shadow-[0_0_5px_rgba(6,182,212,1)]"
                >
                    <X size={20} />
                </button>
                
                <h2 className="text-white font-mono text-xl mb-6 tracking-widest uppercase text-center">
                    Ajustes de Perfil
                </h2>

                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center mb-4">
                        <img
                            src={currentPhotoPreview || "/favicon.svg"}
                            alt="Avatar"
                            className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400"
                        />
                        <span className="text-[10px] text-zinc-500 mt-2">Previsualización de la foto.</span>
                    </div>

                    {/* 1. INPUT FILE */}
                    <label className="text-zinc-400 text-xs font-mono uppercase">Foto de Perfil (Subir)</label>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" hidden />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className={`w-full py-2 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest border transition-colors ${file ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700/50'}`}
                    >
                        <Upload size={16} />
                        {file ? `Archivo Seleccionado: ${file.name}` : 'Subir Imagen de tu Dispositivo'}
                    </button>
                    
                    {/* 2. INPUT URL */}
                    <label className="text-zinc-400 text-xs font-mono uppercase">O usar URL externa (de Google, etc.)</label>
                    <input
                        type="url"
                        value={newPhotoURL}
                        onChange={(e) => {
                            setNewPhotoURL(e.target.value);
                            setFile(null); // Deselecciona el archivo si se introduce una URL
                        }}
                        placeholder="Pega la URL de tu imagen aquí"
                        className="bg-zinc-900 border border-zinc-700 p-2 text-white/90 text-sm font-mono focus:outline-none focus:border-cyan-500/50"
                    />

                    {/* 3. INPUT NICKNAME */}
                    <label className="text-zinc-400 text-xs font-mono uppercase mt-4">Nickname</label>
                    <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Nuevo Nickname"
                        className="bg-zinc-900 border border-zinc-700 p-2 text-white/90 text-sm font-mono focus:outline-none focus:border-cyan-500/50"
                        maxLength={20}
                    />

                    <button
                        type="submit"
                        disabled={isUpdating || !isDirty}
                        className="w-full py-3 bg-cyan-700/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-400 hover:text-white text-xs font-mono uppercase tracking-widest transition-all disabled:opacity-50 mt-4"
                    >
                        {isUpdating ? "Aplicando Cambios..." : "Guardar Cambios"}
                    </button>
                </form>
                
                <hr className="border-zinc-800/50 my-6" />

                <button 
                    onClick={() => { signOut(auth); onClose(); }} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-900/20 hover:bg-red-800/40 border border-red-500/20 text-red-400 text-xs font-mono uppercase tracking-widest transition-all"
                >
                    <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
            </div>
        </div>
    );
};

export const MapComponent = ({ messages, openProfile }) => {
    // ESTE COMPONENTE ESTÁ DEFINIDO EN MapComponent.jsx
    const globeEl = useRef();
    const [GlobePackage, setGlobePackage] = useState(null);
    const [ThreePackage, setThreePackage] = useState(null);
    const [selectedThoughtId, setSelectedThoughtId] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
    const [globeReady, setGlobeReady] = useState(false);
	
    if (!GlobePackage) return <div className="w-full h-full bg-black" />;
    return null; 
};

export const UserWidget = () => {
  const [user, setUser] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    let unsub;
    let mounted = true;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const mod = await import("firebase/auth");
        const { onAuthStateChanged } = mod;
        unsub = onAuthStateChanged(auth, (u) => {
          if (mounted) setUser(u);
        });
      } catch (err) {
        console.error("Error cargando firebase/auth:", err);
      }
    })();
    return () => {
      mounted = false;
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const handleSignIn = async () => {
    if (typeof window === "undefined") return;
    try {
      const mod = await import("firebase/auth");
      const { GoogleAuthProvider, signInWithPopup } = mod;
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Signin error:", err);
    }
  };

  return (
    <>
        <div className="pointer-events-auto flex items-center gap-3 group">
            {user ? (
                <button 
                    onClick={() => setIsProfileModalOpen(true)} 
                    className="flex items-center gap-3 bg-zinc-900 border border-white/5 px-3 py-2 rounded-full hover:scale-[0.98] transition hover:border-cyan-500/50 hover:ring-2 hover:ring-cyan-500/30"
                >
                    <img src={user.photoURL || "/favicon.svg"} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-zinc-800 group-hover:border-cyan-500 transition" />
                    <span className="text-sm text-white font-mono uppercase tracking-wide truncate max-w-[100px]">{user.displayName || "Viajero"}</span>
                    <Settings className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400 transition" />
                </button>
            ) : (
                <button onClick={handleSignIn} className="flex items-center gap-2 bg-cyan-600/10 border border-cyan-500/20 px-3 py-2 rounded-full hover:bg-cyan-600/30 transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                    <LogIn className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-cyan-300 font-mono uppercase tracking-wide">Conectar</span>
                </button>
            )}
        </div>
        {isProfileModalOpen && user && <ProfileModal user={user} onClose={() => setIsProfileModalOpen(false)} />}
    </>
  );
};

export default UserWidget;