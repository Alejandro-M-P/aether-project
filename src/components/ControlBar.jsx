import React, { useState } from "react";
import { Plus, Search, X } from "lucide-react";
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
			{/* 1. FOOTER CON BUSCADOR Y BOTÓN */}
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 py-6 pointer-events-auto bg-linear-to-t from-black/80 to-transparent backdrop-blur-md border-t border-white/10">
				<div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 shadow-2xl transition-all hover:border-white/30 mx-auto max-w-lg">
					{/* Buscador integrado */}
					<div className="flex-1 flex items-center gap-3">
						<Search className="h-4 w-4 text-white/40" />
						<input
							type="text"
							value={$searchQuery}
							onChange={(e) => searchQuery.set(e.target.value)}
							className="w-full bg-transparent border-none text-white/90 text-sm font-light placeholder-white/30 focus:outline-none"
							placeholder="Buscar señales..."
						/>
					</div>

					{/* Separador */}
					<div className="h-5 w-px bg-white/10"></div>

					{/* Botón Abrir Transmisor */}
					<button
						onClick={() => setOpen(true)}
						className="text-white/60 hover:text-white transition-colors p-1"
						title="Transmitir mensaje"
					>
						<Plus size={20} />
					</button>
				</div>
			</footer>

			{/* 2. MODAL DE ENVÍO (Solo visible al hacer click en +) */}
			{open && (
				<div className="fixed inset-0 bg-black/95 backdrop-blur-md z-9999 flex items-center justify-center p-8">
					<div className="w-full max-w-xl relative animate-in fade-in zoom-in duration-200">
						<button
							onClick={() => setOpen(false)}
							className="absolute -top-12 right-0 text-white/30 hover:text-white transition-colors"
						>
							<X size={28} strokeWidth={1} />
						</button>

						<div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
							<form onSubmit={send} className="flex flex-col gap-6">
								<input
									value={cat}
									onChange={(e) => setCat(e.target.value)}
									placeholder="CATEGORÍA (OPCIONAL)"
									className="bg-transparent border-b border-white/10 py-2 text-white/50 text-xs tracking-[0.2em] text-center uppercase focus:outline-none focus:border-white/30 transition-colors"
								/>
								<textarea
									value={msg}
									onChange={(e) => setMsg(e.target.value)}
									className="bg-transparent text-white text-xl font-light text-center resize-none placeholder-white/20 focus:outline-none h-32"
									placeholder="Escribe tu pensamiento aquí..."
									maxLength={140}
									autoFocus
								/>
								<button
									disabled={isSending}
									className="w-full bg-white/10 hover:bg-white/20 text-white/80 py-4 rounded-lg text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-50"
								>
									{isSending ? "Enviando..." : "Liberar al Vacío"}
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
