import React, { useEffect, useState } from "react";
import { User } from "lucide-react"; // <--- 1. Importamos el icono

import { auth } from "../../firebase.js";
import { isLoggedIn, mapKey } from "../../store.js";

import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
} from "firebase/auth";

export default function UserWidget() {
	const [user, setUser] = useState(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			isLoggedIn.set(!!currentUser);
			mapKey.set(mapKey.get() + 1);
            // Eliminamos el warning de consola anterior ya no es necesario
		});
		return () => unsubscribe();
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
	};

	if (user) {
		return (
			<button
				onClick={handleLogout}
				className="pointer-events-auto flex items-center gap-3 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-white/10 hover:border-red-500/50 transition-all group backdrop-blur-md cursor-pointer"
				title="Cerrar sesión"
			>
				{/* 2. Lógica condicional: Si hay foto usa <img>, si no, usa el icono <User> */}
				<div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center bg-black overflow-hidden">
					{user.photoURL ? (
						<img
							src={user.photoURL}
							alt={user.displayName}
							className="w-full h-full object-cover"
						/>
					) : (
						<User className="w-3.5 h-3.5 text-zinc-400" />
					)}
				</div>
				
				<span className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest group-hover:text-red-400">
					{user.displayName?.split(" ")[0] || "USUARIO"}
				</span>
			</button>
		);
	}

	return (
		<button
			onClick={handleLogin}
			className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/40 border border-white/10 backdrop-blur-md shadow-lg hover:bg-white/10 transition-colors cursor-pointer"
		>
			<div className="relative flex h-2 w-2">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
				<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
			</div>
			<span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
				Conectar
			</span>
		</button>
	);
}