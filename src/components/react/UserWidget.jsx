// File: alejandro-m-p/aether-project/aether-project-main/src/components/react/UserWidget.jsx

import React, { useState, useEffect, useRef } from "react";
import {
	X,
	LogIn,
	LogOut,
	Settings,
	Upload,
	Save,
	User,
	Image as ImageIcon,
} from "lucide-react";
import { auth, storage } from "../../firebase.js";
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	updateProfile,
	setPersistence,
	browserLocalPersistence,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const ProfileModal = ({ user, onClose }) => {
	const [newDisplayName, setNewDisplayName] = useState(user.displayName || "");
	const [newPhotoURL, setNewPhotoURL] = useState(user.photoURL || "");
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef(null);

	// Manejar subida de archivo
	const handleFileChange = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		setIsUploading(true);
		try {
			// Crear referencia: avatars/UID_TIMESTAMP
			const fileRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
			await uploadBytes(fileRef, file);
			const url = await getDownloadURL(fileRef);
			setNewPhotoURL(url);
		} catch (error) {
			console.error("Error al subir imagen:", error);
			alert("Error al subir la imagen. Inténtalo de nuevo.");
		} finally {
			setIsUploading(false);
		}
	};

	const handleSave = async () => {
		try {
			await updateProfile(user, {
				displayName: newDisplayName,
				photoURL: newPhotoURL,
			});
			// Recargar para asegurar que los cambios se reflejan en toda la app
			window.location.reload();
		} catch (error) {
			console.error("Error al actualizar perfil:", error);
			alert("Error al guardar los cambios.");
		}
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
			{/* Contenedor principal: rounded-xl (Estructural) */}
			<div className="bg-zinc-950 border border-zinc-800 w-full max-w-md relative rounded-xl shadow-2xl p-6">
				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
				>
					<X size={20} />
				</button>

				<h2 className="text-white font-mono text-lg uppercase tracking-widest mb-6 flex items-center gap-2">
					<Settings className="w-5 h-5 text-cyan-400" />
					Configurar Perfil
				</h2>

				<div className="space-y-6">
					{/* SECCIÓN IMAGEN */}
					<div className="flex flex-col items-center gap-4">
						<div className="relative group w-24 h-24">
							<img
								src={newPhotoURL || "/favicon.svg"}
								alt="Avatar Preview"
								className="w-full h-full rounded-full object-cover border-2 border-zinc-700 group-hover:border-cyan-400 transition-colors"
							/>
							<div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
								<span className="text-[10px] text-white font-mono uppercase">
									Vista Previa
								</span>
							</div>
						</div>

						<div className="flex gap-2 w-full">
							<button
								onClick={() => fileInputRef.current?.click()}
								disabled={isUploading}
								// Botón: rounded-full
								className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs py-2 rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
							>
								{isUploading ? (
									<span className="animate-pulse">Subiendo...</span>
								) : (
									<>
										<Upload size={14} /> Subir Foto
									</>
								)}
							</button>
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileChange}
								accept="image/*"
								className="hidden"
							/>
						</div>

						<div className="w-full relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<ImageIcon size={14} className="text-zinc-500" />
							</div>
							<input
								// Input: rounded-full
								className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs py-2 pl-9 pr-3 rounded-full focus:outline-none focus:border-cyan-500/50 placeholder-zinc-600 font-mono"
								value={newPhotoURL}
								onChange={(e) => setNewPhotoURL(e.target.value)}
								placeholder="O pega una URL de imagen..."
							/>
						</div>
					</div>

					{/* SECCIÓN NOMBRE */}
					<div className="space-y-2">
						<label className="text-xs text-zinc-500 font-mono uppercase">
							Nombre Visible
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<User size={14} className="text-zinc-500" />
							</div>
							<input
								// Input: rounded-full
								className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm py-2 pl-9 pr-3 rounded-full focus:outline-none focus:border-cyan-500/50 placeholder-zinc-600 font-mono"
								value={newDisplayName}
								onChange={(e) => setNewDisplayName(e.target.value)}
								placeholder="Tu nombre..."
								maxLength={20}
							/>
						</div>
					</div>

					<div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
						<button
							onClick={handleSave}
							// Botón: rounded-full
							className="w-full bg-cyan-900/20 hover:bg-cyan-800/30 border border-cyan-500/30 text-cyan-400 py-3 rounded-full text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
						>
							<Save size={14} /> Guardar Cambios
						</button>

						<button
							onClick={() => {
								signOut(auth);
								onClose();
								window.location.reload();
							}}
							className="w-full text-zinc-500 hover:text-red-400 py-2 text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
						>
							<LogOut size={12} /> Cerrar Sesión
						</button>
					</div>
				</div>
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
			await setPersistence(auth, browserLocalPersistence);
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
						className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur border border-white/5 px-4 py-2 rounded-full hover:scale-[0.98] transition hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.1)]"
					>
						<img
							src={user.photoURL || "/favicon.svg"}
							alt="avatar"
							className="w-8 h-8 rounded-full object-cover border-2 border-zinc-800"
						/>
						<span className="text-xs md:text-sm text-zinc-300 font-mono uppercase tracking-wide truncate max-w-[100px] md:max-w-[150px]">
							{user.displayName || "Viajero"}
						</span>
						<Settings className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
					</button>
				) : (
					<button
						onClick={handleSignIn}
						className="flex items-center gap-2 bg-cyan-600/10 border border-cyan-500/20 px-4 py-2 rounded-full hover:bg-cyan-600/30 transition-all hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
					>
						<LogIn className="w-4 h-4 text-cyan-400" />
						<span className="text-xs md:text-sm text-cyan-300 font-mono uppercase tracking-wide">
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