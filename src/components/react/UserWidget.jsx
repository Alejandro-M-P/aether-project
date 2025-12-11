import React, { useEffect, useState, useRef } from "react";
// 🚨 Mantenemos la ruta original
import { auth } from "../../firebase.js";
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
	updateProfile,
} from "firebase/auth";
// ☁️ Importamos funciones de Storage
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User, LogOut, Save, X, Edit3, Camera, Loader2, UploadCloud } from "lucide-react";

export default function UserWidget() {
	const [user, setUser] = useState(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	
	// Estados para edición
	const [newDisplayName, setNewDisplayName] = useState("");
	const [imageFile, setImageFile] = useState(null); // Archivo seleccionado
	const [previewUrl, setPreviewUrl] = useState(null); // Previsualización local
	const [loading, setLoading] = useState(false);

	const menuRef = useRef(null);
	const fileInputRef = useRef(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			if (currentUser) {
				setNewDisplayName(currentUser.displayName || "");
				setPreviewUrl(currentUser.photoURL || "");
			}
		});

		const handleClickOutside = (event) => {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				setIsOpen(false);
				setIsEditing(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			unsubscribe();
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleLogin = async () => {
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
		} catch (error) {
			console.error("Error al iniciar sesión:", error);
		}
	};

	const handleLogout = async () => {
		await signOut(auth);
		setIsOpen(false);
	};

	// Manejar selección de archivo
	const handleFileSelect = (e) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			setImageFile(file);
			setPreviewUrl(URL.createObjectURL(file)); // Crear URL temporal para previsualizar
		}
	};

	const handleSaveProfile = async () => {
		if (!auth.currentUser) return;
		setLoading(true);
		try {
			let photoURL = auth.currentUser.photoURL;

			// 1. Si hay un archivo nuevo, subirlo a Firebase Storage
			if (imageFile) {
				const storage = getStorage();
				// Crear referencia única: avatars/UID/timestamp_nombre
				const storageRef = ref(storage, `avatars/${auth.currentUser.uid}/${Date.now()}_${imageFile.name}`);
				
				// Subir bytes
				const snapshot = await uploadBytes(storageRef, imageFile);
				
				// Obtener URL pública
				photoURL = await getDownloadURL(snapshot.ref);
			}

			// 2. Actualizar perfil de Auth
			await updateProfile(auth.currentUser, {
				displayName: newDisplayName,
				photoURL: photoURL
			});

			// Actualizar estado local
			setUser({ ...auth.currentUser, displayName: newDisplayName, photoURL: photoURL });
			setIsEditing(false);
			setImageFile(null); // Limpiar archivo seleccionado
		} catch (error) {
			console.error("Error actualizando perfil:", error);
			alert("Error al actualizar. Verifica tu conexión.");
		} finally {
			setLoading(false);
		}
	};

	// ------------------ ESTADO: NO CONECTADO ------------------
	if (!user) {
		return (
			<button
				onClick={handleLogin}
				className="pointer-events-auto group relative flex items-center gap-3 px-5 py-2.5 rounded-full bg-zinc-950/50 border border-white/10 backdrop-blur-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:bg-zinc-900/80 hover:border-emerald-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
			>
				<div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
				
				<div className="relative flex h-2.5 w-2.5">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
					<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
				</div>
				<span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-widest group-hover:text-white transition-colors">
					Conectar
				</span>
			</button>
		);
	}

	// ------------------ ESTADO: CONECTADO ------------------
	return (
		<div className="relative pointer-events-auto" ref={menuRef}>
			{/* Botón Principal de Usuario */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-3 pl-2 pr-4 py-2 rounded-full border backdrop-blur-xl transition-all duration-300 cursor-pointer shadow-lg ${
					isOpen 
						? "bg-zinc-800 border-white/20 ring-2 ring-white/5" 
						: "bg-zinc-950/60 border-white/10 hover:border-white/30 hover:bg-zinc-900"
				}`}
			>
				<img
					src={user.photoURL || "/favicon.svg"}
					alt={user.displayName}
					className="w-8 h-8 rounded-full border-2 border-zinc-700 object-cover"
				/>
				<div className="flex flex-col items-start">
					<span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none mb-0.5">
						Operador
					</span>
					<span className="text-xs font-bold text-white tracking-wide leading-none max-w-[100px] truncate">
						{user.displayName?.split(" ")[0] || "Anónimo"}
					</span>
				</div>
			</button>

			{/* Menú Desplegable / Panel de Perfil */}
			{isOpen && (
				<div className="absolute top-full right-0 mt-4 w-80 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-5 duration-200 z-50 ring-1 ring-white/5">
					
					{/* Cabecera del Menú */}
					<div className="relative h-28 bg-gradient-to-b from-zinc-800 to-zinc-950 flex flex-col items-center justify-center border-b border-white/5 pt-4">
						<div className="absolute inset-0 bg-[url('/favicon.svg')] bg-repeat opacity-5"></div>
						<button 
							onClick={() => setIsOpen(false)}
							className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
						>
							<X size={16} />
						</button>
						
						{/* Avatar con opción de carga en modo edición */}
						<div className="relative group">
							<div 
								className={`relative w-20 h-20 rounded-full border-4 border-zinc-950 shadow-xl overflow-hidden bg-zinc-900 ${isEditing ? "cursor-pointer ring-2 ring-emerald-500/50" : ""}`}
								onClick={() => isEditing && fileInputRef.current.click()}
							>
								<img
									src={previewUrl || user.photoURL || "/favicon.svg"}
									alt="Avatar"
									className={`w-full h-full object-cover transition-opacity ${isEditing ? "group-hover:opacity-50" : ""}`}
								/>
								
								{/* Icono de cámara sobre la imagen al editar */}
								{isEditing && (
									<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
										<UploadCloud size={24} className="text-white" />
									</div>
								)}
							</div>

							{/* Indicador de estado online (solo si no se edita) */}
							{!isEditing && (
								<div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-lg">
									<div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
								</div>
							)}
							
							{/* Input de archivo oculto */}
							<input 
								type="file" 
								ref={fileInputRef} 
								className="hidden" 
								accept="image/*" 
								onChange={handleFileSelect}
							/>
						</div>
						
						{isEditing && (
							<span className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wide">
								Toca para cambiar foto
							</span>
						)}
					</div>

					{/* Contenido del Cuerpo */}
					<div className="pt-6 pb-6 px-6 space-y-5">
						
						{/* Modo Edición */}
						{isEditing ? (
							<div className="space-y-4 animate-in fade-in zoom-in duration-200">
								<div>
									<label className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-1 block">Nickname</label>
									<div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 focus-within:border-emerald-500/50 transition-colors">
										<User size={14} className="text-zinc-500" />
										<input 
											value={newDisplayName}
											onChange={(e) => setNewDisplayName(e.target.value)}
											className="bg-transparent border-none text-sm text-white focus:outline-none w-full font-mono"
											placeholder="Nombre de Viajero"
										/>
									</div>
								</div>

								<div className="flex gap-2 pt-2">
									<button 
										onClick={() => {
											setIsEditing(false);
											setImageFile(null);
											setPreviewUrl(user.photoURL); // Restaurar preview
										}}
										className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
									>
										Cancelar
									</button>
									<button 
										onClick={handleSaveProfile}
										disabled={loading}
										className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{loading ? (
											<><Loader2 size={14} className="animate-spin" /> Guardando</>
										) : (
											<><Save size={14} /> Guardar</>
										)}
									</button>
								</div>
							</div>
						) : (
							/* Modo Visualización */
							<div className="text-center space-y-1">
								<h3 className="text-xl text-white font-bold tracking-tight">
									{user.displayName || "Sin Nombre"}
								</h3>
								<p className="text-xs text-zinc-500 font-mono truncate px-4">
									{user.email}
								</p>
								
								<button 
									onClick={() => {
										setIsEditing(true);
										setNewDisplayName(user.displayName || "");
									}}
									className="mt-4 text-[10px] font-mono uppercase tracking-widest text-emerald-500 hover:text-emerald-400 flex items-center justify-center gap-2 mx-auto py-2 px-4 hover:bg-emerald-500/10 rounded-full transition-all"
								>
									<Edit3 size={12} /> Editar Perfil
								</button>
							</div>
						)}

						<div className="h-px bg-white/5 w-full my-4"></div>

						<button
							onClick={handleLogout}
							className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all text-xs font-mono uppercase tracking-widest group"
						>
							<LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
							Desconectar Sistema
						</button>
					</div>
				</div>
			)}
		</div>
	);
}