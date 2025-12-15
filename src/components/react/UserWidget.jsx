import React, { useState, useEffect, useRef } from "react";
import { X, LogIn, LogOut, Settings, Upload } from "lucide-react";
import { auth, storage } from "../../firebase.js";
// IMPORTANTE: Importamos setPersistence y browserLocalPersistence
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	updateProfile,
	setPersistence,
	browserLocalPersistence,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ... (El código del ProfileModal se mantiene igual, lo resumo para ahorrar espacio) ...
const ProfileModal = ({ user, onClose }) => {
	// ... Copia aquí tu ProfileModal de siempre o el que te pasé anteriormente ...
	// Si necesitas que te lo escriba entero dímelo, pero la lógica importante está abajo en UserWidget.
	// Simplemente asegúrate de que el ProfileModal que tienes ya funciona (con la opción de URL externa).
	const [newDisplayName, setNewDisplayName] = useState(user.displayName || "");
	const [newPhotoURL, setNewPhotoURL] = useState(user.photoURL || "");
	// ... (resto de lógica del modal)
	// ...
	// PARA QUE NO HAYA ERROR, TE DEJO UNA VERSIÓN SIMPLIFICADA DEL RETURN DEL MODAL:
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
			<div className="bg-zinc-950 p-6 border border-zinc-800 w-full max-w-sm relative">
				<button onClick={onClose} className="absolute top-2 right-2 text-white">
					<X />
				</button>
				<h2 className="text-white mb-4">Perfil</h2>
				<input
					className="w-full bg-zinc-900 text-white p-2 mb-2"
					value={newDisplayName}
					onChange={(e) => setNewDisplayName(e.target.value)}
					placeholder="Nombre"
				/>
				<input
					className="w-full bg-zinc-900 text-white p-2 mb-4"
					value={newPhotoURL}
					onChange={(e) => setNewPhotoURL(e.target.value)}
					placeholder="URL Foto"
				/>
				<button
					onClick={async () => {
						await updateProfile(user, {
							displayName: newDisplayName,
							photoURL: newPhotoURL,
						});
						onClose();
					}}
					className="bg-cyan-600 text-white w-full py-2"
				>
					Guardar
				</button>
				<button
					onClick={() => {
						signOut(auth);
						onClose();
					}}
					className="mt-4 text-red-500 w-full text-center text-xs"
				>
					Cerrar Sesión
				</button>
			</div>
		</div>
	);
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
			// 1. CONFIGURAR PERSISTENCIA LOCAL
			// Esto le dice a Firebase: "Guarda la sesión en el navegador para siempre"
			await setPersistence(auth, browserLocalPersistence);

			// 2. INICIAR SESIÓN
			const provider = new GoogleAuthProvider();
			await signInWithPopup(auth, provider);
		} catch (err) {
			console.error("Signin error:", err);
			alert("Error al conectar. Verifica tu configuración.");
		}
	};

	return (
		<>
			<div className="pointer-events-auto flex items-center gap-3 group">
				{user ? (
					<button
						onClick={() => setIsProfileModalOpen(true)}
						className="flex items-center gap-3 bg-zinc-900 border border-white/5 px-3 py-2 rounded-full hover:scale-[0.98] transition hover:border-cyan-500/50"
					>
						<img
							src={user.photoURL || "/favicon.svg"}
							alt="avatar"
							className="w-8 h-8 rounded-full object-cover border-2 border-zinc-800"
						/>
						<span className="text-sm text-white font-mono uppercase tracking-wide truncate max-w-[100px]">
							{user.displayName || "Viajero"}
						</span>
						<Settings className="w-4 h-4 text-zinc-400" />
					</button>
				) : (
					<button
						onClick={handleSignIn}
						className="flex items-center gap-2 bg-cyan-600/10 border border-cyan-500/20 px-3 py-2 rounded-full hover:bg-cyan-600/30 transition"
					>
						<LogIn className="w-4 h-4 text-cyan-400" />
						<span className="text-sm text-cyan-300 font-mono uppercase tracking-wide">
							Conectar
						</span>
					</button>
				)}
			</div>
			{isProfileModalOpen && user && (
				<ProfileModal
					user={user}
					onClose={() => setIsProfileModalOpen(false)}
				/>
			)}
		</>
	);
};

export default UserWidget;
