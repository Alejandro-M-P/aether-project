import React, { useState } from "react";
import { Search, X } from "lucide-react"; // Eliminamos 'Plus' de los imports
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../store";

export default function ControlBar() {
	const $searchQuery = useStore(searchQuery);
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [isSending, setIsSending] = useState(false);

	// Función para enviar mensaje
	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;
		setIsSending(true);
		try {
			await addDoc(collection(db, "thoughts"), {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
			});
			setMsg("");
			setCat("");
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<>
			{/* 1. FOOTER INTEGRADO */}
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 py-8 pointer-events-none flex justify-center">
				{/* Cápsula Flotante Unificada */}
				<div className="pointer-events-auto flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full pl-5 pr-2 py-2 shadow-2xl transition-all hover:border-white/20 w-full max-w-lg group">
					{/* Buscador */}
					<div className="flex-1 flex items-center gap-3">
						<Search className="h-4 w-4 text-white/40 group-hover:text-white/60 transition-colors" />
						<input
							type="text"
							value={$searchQuery}
							onChange={(e) => searchQuery.set(e.target.value)}
							className="w-full bg-transparent border-none text-white/90 text-sm font-mono placeholder-white/30 focus:outline-none h-full"
							placeholder="Buscar frecuencia..."
						/>
					</div>

					{/* Botón Transmitir Integrado (Texto en lugar de Icono +) */}
					<button
						onClick={() => setOpen(true)}
						className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-mono uppercase tracking-widest px-4 py-2 rounded-full border border-white/5 transition-all hover:scale-105 active:scale-95"
					>
						Transmitir
					</button>
				</div>
			</footer>

			{/* 2. MODAL DE ENVÍO */}
			{open && (
				<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60] flex items-center justify-center p-6">
					<div className="w-full max-w-lg relative animate-in fade-in zoom-in duration-300">
						{/* Botón cerrar */}
						<button
							onClick={() => setOpen(false)}
							className="absolute -top-12 right-0 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest"
						>
							[ Cerrar ] <X size={20} />
						</button>

						<div className="bg-zinc-950 border border-white/10 rounded-2xl p-8 shadow-2xl ring-1 ring-white/5">
							<div className="text-center mb-8">
								<h2 className="text-white font-mono text-sm tracking-[0.3em] uppercase opacity-70">
									Nueva Transmisión
								</h2>
							</div>

							<form onSubmit={send} className="flex flex-col gap-6">
								<input
									value={cat}
									onChange={(e) => setCat(e.target.value)}
									placeholder="CANAL / CATEGORÍA"
									className="bg-transparent border-b border-white/10 py-2 text-white/60 text-xs font-mono tracking-0.1em text-center uppercase focus:outline-none focus:border-emerald-500/50 transition-colors"
								/>
								<textarea
									value={msg}
									async
									onChange={(e) => setMsg(e.target.value)}
									className="bg-transparent text-white text-lg font-light text-center resize-none placeholder-white/20 focus:outline-none h-32 leading-relaxed"
									placeholder="Escribe tu mensaje al vacío..."
									maxLength={280}
									autoFocus
								/>
								<button
									disabled={isSending}
									className="w-full bg-white/5 hover:bg-emerald-900/30 border border-white/10 hover:border-emerald-500/30 text-white/70 hover:text-emerald-400 py-4 rounded-lg text-xs font-mono tracking-[0.2em] uppercase transition-all disabled:opacity-50 mt-2 group"
								>
									{isSending ? (
										<span className="animate-pulse">Enviando...</span>
									) : (
										<span>Enviar Señal</span>
									)}
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
