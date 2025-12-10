import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, X } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	addDoc,
	onSnapshot,
	serverTimestamp,
	query,
	orderBy,
	limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../store";

// --- SEARCHBAR ---
export const SearchBar = () => {
	const $searchQuery = useStore(searchQuery);

	return (
		<div className="w-full relative">
			<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
				<Search className="h-5 w-5 text-gray-500" />
			</div>
			<input
				type="text"
				value={$searchQuery}
				onChange={(e) => searchQuery.set(e.target.value)}
				// Fondo blanco y texto negro para máxima visibilidad
				className="w-full bg-white border-2 border-gray-300 rounded-full py-3 pl-10 pr-4 text-black text-base focus:outline-none focus:border-blue-500 shadow-md"
				placeholder="Buscar mensajes..."
			/>
		</div>
	);
};

// --- TRANSMITTER ---
export const Transmitter = () => {
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [isSending, setIsSending] = useState(false);

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
		} finally {
			setIsSending(false);
		}
	};

	if (!open)
		return (
			<button
				onClick={() => setOpen(true)}
				className="bg-blue-600 border-2 border-blue-400 rounded-full p-3 text-white hover:bg-blue-700 transition-all shadow-md"
			>
				<Plus size={24} strokeWidth={3} />
			</button>
		);

	return (
		<div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-6 relative shadow-2xl">
				<button
					onClick={() => setOpen(false)}
					className="absolute top-4 right-4 text-white hover:text-red-400"
				>
					<X size={24} />
				</button>
				<h2 className="text-white text-lg font-bold mb-4 text-center">
					Nuevo Mensaje
				</h2>
				<form onSubmit={send} className="space-y-4">
					<input
						value={cat}
						onChange={(e) => setCat(e.target.value)}
						placeholder="CATEGORÍA"
						className="w-full bg-zinc-800 border border-zinc-600 rounded p-2 text-white text-sm uppercase focus:outline-none"
					/>
					<textarea
						value={msg}
						onChange={(e) => setMsg(e.target.value)}
						className="w-full bg-zinc-800 border border-zinc-600 rounded p-3 text-white text-lg resize-none focus:outline-none"
						placeholder="Escribe aquí..."
						rows={4}
						autoFocus
					/>
					<button
						disabled={isSending}
						className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{isSending ? "ENVIANDO..." : "ENVIAR AHORA"}
					</button>
				</form>
			</div>
		</div>
	);
};

// --- UNIVERSE CANVAS ---
export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const starsRef = useRef([]);

	useEffect(() => {
		signInAnonymously(auth).catch(() => {});
		// Inicializar estrellas
		if (starsRef.current.length === 0) {
			for (let i = 0; i < 100; i++) {
				starsRef.current.push({
					x: Math.random(),
					y: Math.random(),
					size: Math.random() * 1.5,
					alpha: Math.random(),
				});
			}
		}
		// Escuchar Firebase
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(50)
		);
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const valid = [];
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message) {
					valid.push({
						x: Math.random() * window.innerWidth,
						y: Math.random() * window.innerHeight,
						text: data.message,
						category: data.category || "",
						vx: (Math.random() - 0.5) * 0.5,
						vy: (Math.random() - 0.5) * 0.5,
						color: "#ffffff",
					});
				}
			});
			particlesRef.current = valid;
		});
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		let animationId;

		const render = () => {
			// Ajustar tamaño dinámicamente
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			// Fondo negro
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Dibujar estrellas
			ctx.fillStyle = "#ffffff";
			starsRef.current.forEach((star) => {
				ctx.globalAlpha = star.alpha;
				ctx.beginPath();
				ctx.arc(
					star.x * canvas.width,
					star.y * canvas.height,
					star.size,
					0,
					Math.PI * 2
				);
				ctx.fill();
			});

			// Dibujar partículas (mensajes)
			const filterText = searchQuery.get().toLowerCase();
			ctx.globalAlpha = 1;
			ctx.font = "16px Arial";
			ctx.fillStyle = "#ffffff";

			particlesRef.current.forEach((p) => {
				// Movimiento básico
				p.x += p.vx;
				p.y += p.vy;

				// Rebote en bordes
				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				// Filtrado
				if (!filterText || p.text.toLowerCase().includes(filterText)) {
					ctx.fillText(p.text, p.x, p.y);
				}
			});

			animationId = requestAnimationFrame(render);
		};
		render();
		return () => cancelAnimationFrame(animationId);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 w-full h-full bg-black -z-10"
		/>
	);
};

// Exportación por defecto para evitar errores
export default function Islands() {
	return <div></div>;
}
